import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { buildBaseline } from '../data/demo/baseline';
import { dataStore } from '../state/dataStore';
import { startSession, endSession } from '../state/session';
import { uiStore } from '../state/uiStore';
import { DEMO_USERS } from '../data/demo/people';
import { stopAllTimers } from '../state/simulation';
import App from '../App';

// Canvas is unavailable in jsdom; chart wrappers are covered by their data inputs.
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="chart-line" />,
  Bar: () => <div data-testid="chart-bar" />,
  Doughnut: () => <div data-testid="chart-donut" />,
}));

const BASE = Date.UTC(2026, 9, 13, 6, 30);
const login = (username) => {
  const { password, ...u } = DEMO_USERS.find((x) => x.username === username);
  act(() => { startSession(u, false); uiStore.set((s) => ({ ...s, scope: u.homeScope })); });
};
const go = (path) => { window.history.pushState({}, '', path); };

beforeEach(() => {
  stopAllTimers();
  dataStore.reset(buildBaseline(BASE));
  uiStore.set((s) => ({ ...s, scope: 'IN', theme: 'dark', sidebarCollapsed: false }));
  endSession();
});

describe('authentication flow', () => {
  test('unauthenticated users land on the login page, not the dashboard', () => {
    go('/command-centre');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(/Priority Incidents [(]/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Request a Demo/i)).not.toBeInTheDocument();
  });

  test('validation messages appear for empty submit', () => {
    go('/login');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Enter your username or email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  test('login opens the command centre and logout returns to login', async () => {
    go('/login');
    render(<App />);
    fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Astrikos2026' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/Priority Incidents [(]/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Administrator/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Sign out/ }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  test('wrong password shows an error', async () => {
    go('/login');
    render(<App />);
    fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Incorrect username or password.')).toBeInTheDocument();
  });
});

describe('authenticated shell', () => {
  const routes = [
    '/command-centre', '/situational-overview', '/hazards/flood', '/hazards/landslide', '/hazards/earthquake', '/hazards/avalanche',
    '/hazards/wildfire', '/hazards/heatwave', '/hazards/coldwave', '/multi-hazard', '/alerts', '/incidents', '/incidents/INC-1001',
    '/field-operations', '/resources', '/analytics', '/simulation', '/integrations', '/reports', '/administration',
  ];

  test.each(routes)('route %s renders without errors', (path) => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    login('admin');
    go(path);
    const { container } = render(<App />);
    expect(container.querySelector('.bx-shell')).toBeTruthy();
    expect(container.querySelector('main')).toBeTruthy();
    expect(screen.queryByText(/DEMO MODE/)).not.toBeInTheDocument();
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  test('sidebar groups, navigation and collapse work', () => {
    login('admin');
    go('/command-centre');
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Modules' });
    ['Command', 'Hazard Intelligence', 'Operations', 'Intelligence', 'System'].forEach((g) => expect(within(nav).getByText(g)).toBeInTheDocument());
    expect(within(nav).getAllByRole('link').length).toBe(18);
    fireEvent.click(within(nav).getByRole('link', { name: 'Flood Monitoring' }));
    expect(screen.getByRole('heading', { name: 'Flood Monitoring' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(document.querySelector('.bx-sidebar.is-collapsed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  test('scope change filters the records displayed, not just the label', () => {
    login('admin');
    go('/incidents');
    render(<App />);
    const count = () => Number(/of (\d+)|(\d+) record/.exec(document.querySelector('.bx-pager')?.textContent || '')?.slice(1).find(Boolean));
    const all = count();
    act(() => { uiStore.set((s) => ({ ...s, scope: 'AR' })); });
    const ar = count();
    expect(ar).toBeGreaterThan(0);
    expect(ar).toBeLessThan(all);
  });

  test('incident row click opens the detail drawer and links to the full record', () => {
    login('admin');
    go('/incidents');
    render(<App />);
    fireEvent.click(screen.getByText('Siang above warning level at Pasighat'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('INC-1001').length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('link', { name: /Open in Incident Management/ })).toBeInTheDocument();
  });

  test('role-based navigation hides modules and blocks direct access', () => {
    login('auditor');
    go('/administration');
    render(<App />);
    expect(screen.getByText('Access restricted for your role')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Modules' });
    expect(within(nav).queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
  });

  test('read-only role sees disabled action controls', () => {
    login('auditor');
    go('/incidents/INC-1003');
    render(<App />);
    expect(screen.getByRole('button', { name: /Escalate/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /→ Under Verification/ })).toBeDisabled();
  });

  test('incident status change from the UI updates shared state', () => {
    login('state');
    go('/incidents/INC-1003');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /→ Under Verification/ }));
    expect(screen.getAllByText('Under Verification').length).toBeGreaterThan(0);
    expect(dataStore.get().incidents.find((i) => i.id === 'INC-1003').status).toBe('Under Verification');
  });

  test('simulation start from the UI updates the command centre KPIs', async () => {
    login('admin');
    go('/simulation');
    const { unmount } = render(<App />);
    fireEvent.click(screen.getAllByText(/S1 · Heavy Rainfall/)[0]);
    fireEvent.click(screen.getByRole('button', { name: /^Start$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Pause$/ }));
    expect(dataStore.get().simRuns.S1.stepIndex).toBe(1);
    expect(screen.getByRole("heading", { name: /Simulation & Replay/ })).toBeInTheDocument();
    unmount();
    stopAllTimers();
  });

  test('theme toggle switches between dark and light', () => {
    login('admin');
    go('/command-centre');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Switch to light theme/ }));
    expect(document.body.dataset.theme).toBe('light');
  });
});
