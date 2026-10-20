import {
  LayoutDashboard, Radar, Waves, Mountain, Activity, MountainSnow, Flame, ThermometerSun, Snowflake, Layers, Megaphone, Siren, HardHat,
  Truck, BrainCircuit, ChartLine, Play, Plug, ChartColumn, Settings, Users, Wind, Sun, Moon, Zap, TriangleAlert, MapPin, ClipboardList,
  DatabaseZap, Info, CircleAlert, OctagonAlert, Circle, CircleCheck, CircleX, CirclePlus, CirclePause, RefreshCw, RefreshCcw, Lock, Check,
  Hourglass, Timer, CircleHelp, User, Globe, Map, Clock, Bell, Search, X, Ban, OctagonX, Construction, Route, Pin, Wrench,
  Flag, Eye, Trash2, Archive, Landmark, Inbox, ArrowUp, ArrowDown, Minus, Bookmark, WifiOff,
} from 'lucide-react';

/**
 * Single source of truth for icons: config slug -> Lucide outline component.
 * Slugs are referenced from src/config/icons.js; components never import Lucide icons for
 * app semantics directly, they go through <HazardIcon name="slug" />.
 */
export const ICONS = {
  // hazards
  'water-wave': Waves, mountain: Mountain, 'seismic-wave': Activity, avalanche: MountainSnow, fire: Flame, thermometer: ThermometerSun,
  snowflake: Snowflake, 'puzzle-piece': Layers, cyclone: Wind, desert: Sun, 'high-voltage': Zap,
  'snow-capped-mountain': MountainSnow, 'vibration-mode': Activity,
  // modules
  'control-knobs': LayoutDashboard, satellite: Radar, loudspeaker: Megaphone, 'police-car-light': Siren, 'safety-vest': HardHat, minibus: Truck,
  brain: BrainCircuit, 'chart-increasing': ChartLine, 'play-button': Play, 'electric-plug': Plug, 'bar-chart': ChartColumn, gear: Settings,
  'busts-in-silhouette': Users,
  // KPI
  warning: TriangleAlert, 'round-pushpin': MapPin, clipboard: ClipboardList, 'database-zap': DatabaseZap,
  // severity / status
  'blue-square': Info, 'yellow-square': CircleAlert, 'orange-square': TriangleAlert, 'red-square': OctagonAlert, 'white-circle': Circle,
  'green-circle': CircleCheck, 'orange-circle': CircleAlert, 'red-circle': CircleX, 'yellow-circle': CircleAlert, 'blue-circle': Info,
  'new-button': CirclePlus, 'pause-button': CirclePause, 'counterclockwise-arrows': RefreshCw, 'anticlockwise-arrows': RefreshCcw,
  'check-mark-button': CircleCheck, 'check-mark': Check, locked: Lock, 'locked-with-key': Lock, 'hourglass-not-done': Hourglass,
  'hourglass-done': Timer, 'red-question-mark': CircleHelp, 'bust-in-silhouette': User, magnifier: Search,
  'cross-mark': X, prohibited: Ban, 'no-entry': OctagonX, construction: Construction, motorway: Route, pushpin: Pin,
  'hammer-and-wrench': Wrench, 'chequered-flag': Flag, eye: Eye, wastebasket: Trash2, 'card-index-dividers': Archive,
  'classical-building': Landmark, 'inbox-tray': Inbox, 'up-arrow': ArrowUp, 'down-arrow': ArrowDown, minus: Minus, 'bookmark-tabs': Bookmark,
  'no-mobile': WifiOff,
  // header / misc
  'flag-india': Globe, 'world-map': Map, 'three-oclock': Clock, 'crescent-moon': Moon, sun: Sun, bell: Bell,
};
export { Eye, Siren, Megaphone };
