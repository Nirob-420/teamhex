/**
 * The lucide icon set used across the site.
 *
 * Shared by `src/main.js` (the full one-page experience) and `src/page.js`
 * (the section route pages) so both render identical icons and neither has to
 * maintain its own list.
 */

import {
  createIcons, Activity, ArrowUpRight, ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
  Play, Crosshair, MousePointer2, ShieldCheck, Shield, ShieldPlus, Users, Flame,
  Clapperboard, Images, Radio, Youtube, ScanSearch, ChevronsUp, Gamepad2,
  Fingerprint, LockKeyhole, MessageCircle, Facebook, Mail, ExternalLink,
  Search, Bookmark, BookmarkCheck, Share2, Link2, Check, Keyboard, Pause, Download, WifiOff, Wifi, Trash2,
  MailCheck, X, Minus, Plus, RotateCcw, ScanLine, Bomb, Zap, ScanEye, Orbit, Move3d, Layers3
} from 'lucide';

export const icons = {
  Activity, ArrowUpRight, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Play, Crosshair,
  MousePointer2, ShieldCheck, Shield, ShieldPlus, Users, Flame, Clapperboard, Images,
  Radio, Youtube, ScanSearch, ChevronsUp, Gamepad2, Fingerprint, LockKeyhole,
  MessageCircle, Facebook, Mail, ExternalLink, MailCheck, X, Minus, Plus, RotateCcw,
  ScanLine, Bomb, Zap, ScanEye, Orbit, Move3d, Layers3, Search, Bookmark, BookmarkCheck,
  Share2, Link2, Check, Keyboard, Pause, Download, WifiOff, Wifi, Trash2,
};

/** Replaces every `<i data-lucide="…">` placeholder with real SVG. */
export const refreshIcons = () => createIcons({ icons, attrs: { 'aria-hidden': 'true' } });
