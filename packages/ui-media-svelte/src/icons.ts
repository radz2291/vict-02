import Menu from '@lucide/svelte/icons/menu';
import X from '@lucide/svelte/icons/x';
import Search from '@lucide/svelte/icons/search';
import Send from '@lucide/svelte/icons/send';
import Plus from '@lucide/svelte/icons/plus';
import Minus from '@lucide/svelte/icons/minus';
import Check from '@lucide/svelte/icons/check';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import ChevronUp from '@lucide/svelte/icons/chevron-up';
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import ArrowLeft from '@lucide/svelte/icons/arrow-left';
import ArrowRight from '@lucide/svelte/icons/arrow-right';
import ArrowUp from '@lucide/svelte/icons/arrow-up';
import ArrowDown from '@lucide/svelte/icons/arrow-down';
import Home from '@lucide/svelte/icons/house';
import Settings from '@lucide/svelte/icons/settings';
import User from '@lucide/svelte/icons/user';
import Users from '@lucide/svelte/icons/users';
import MessageCircle from '@lucide/svelte/icons/message-circle';
import Mail from '@lucide/svelte/icons/mail';
import Bell from '@lucide/svelte/icons/bell';
import Heart from '@lucide/svelte/icons/heart';
import Star from '@lucide/svelte/icons/star';
import Image from '@lucide/svelte/icons/image';
import Play from '@lucide/svelte/icons/play';
import Pause from '@lucide/svelte/icons/pause';
import Volume2 from '@lucide/svelte/icons/volume-2';
import VolumeX from '@lucide/svelte/icons/volume-x';
import Download from '@lucide/svelte/icons/download';
import Upload from '@lucide/svelte/icons/upload';
import Copy from '@lucide/svelte/icons/copy';
import Trash2 from '@lucide/svelte/icons/trash-2';
import Pencil from '@lucide/svelte/icons/pencil';
import Filter from '@lucide/svelte/icons/funnel';
import Calendar from '@lucide/svelte/icons/calendar';
import Clock from '@lucide/svelte/icons/clock';
import Link from '@lucide/svelte/icons/link';
import ExternalLink from '@lucide/svelte/icons/external-link';
import Info from '@lucide/svelte/icons/info';
import CircleHelp from '@lucide/svelte/icons/circle-question-mark';
import CircleAlert from '@lucide/svelte/icons/circle-alert';
import LoaderCircle from '@lucide/svelte/icons/loader-circle';
import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
import Eye from '@lucide/svelte/icons/eye';
import EyeOff from '@lucide/svelte/icons/eye-off';
import Lock from '@lucide/svelte/icons/lock';
import Unlock from '@lucide/svelte/icons/lock-open';
import File from '@lucide/svelte/icons/file';
import Folder from '@lucide/svelte/icons/folder';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import ZoomIn from '@lucide/svelte/icons/zoom-in';
import ZoomOut from '@lucide/svelte/icons/zoom-out';
import Maximize from '@lucide/svelte/icons/maximize';
import Save from '@lucide/svelte/icons/save';
import Undo from '@lucide/svelte/icons/undo';
import Redo from '@lucide/svelte/icons/redo';
import GripVertical from '@lucide/svelte/icons/grip-vertical';
import Globe from '@lucide/svelte/icons/globe';
import type { Component } from 'svelte';
import { validateVector, type VectorGraphic } from './vectors.js';
import { suppliedIconManifest, suppliedIconKeys, type IconMetadata } from './icon-manifest.js';
export { suppliedIconManifest, searchIconManifest } from './icon-manifest.js';
export type { IconMetadata } from './icon-manifest.js';
export interface IconEntry extends IconMetadata {
  readonly component?: Component<any>;
  readonly vector?: VectorGraphic;
}
const supplied = {
  Menu,
  X,
  Search,
  Send,
  Plus,
  Minus,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Home,
  Settings,
  User,
  Users,
  MessageCircle,
  Mail,
  Bell,
  Heart,
  Star,
  Image,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Upload,
  Copy,
  Trash2,
  Pencil,
  Filter,
  Calendar,
  Clock,
  Link,
  ExternalLink,
  Info,
  CircleHelp,
  CircleAlert,
  LoaderCircle,
  MoreHorizontal,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  File,
  Folder,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize,
  Save,
  Undo,
  Redo,
  GripVertical,
  Globe,
} satisfies Record<(typeof suppliedIconKeys)[number], Component<any>>;
export function createIconRegistry(custom: readonly IconEntry[] = []) {
  const entries = new Map<string, IconEntry>();
  const identity = (pack: string, name: string, revision: string) => `${pack}/${name}@${revision}`;
  const register = (entry: IconEntry) => {
    if (
      !/^[a-zA-Z0-9_.-]{1,80}$/.test(entry.pack) ||
      !/^[a-zA-Z0-9_.-]{1,100}$/.test(entry.name) ||
      !entry.revision ||
      entry.revision.length > 80 ||
      !entry.label ||
      !entry.license ||
      !entry.provenance ||
      (!entry.component && !entry.vector)
    )
      throw Error(
        'Icon registration needs a valid identity, provenance/license and component or inert vector.',
      );
    const key = identity(entry.pack, entry.name, entry.revision);
    if (entries.has(key)) throw Error(`Duplicate icon identity: ${key}`);
    entries.set(key, {
      ...entry,
      ...(entry.vector ? { vector: validateVector(entry.vector) } : {}),
    });
  };
  suppliedIconManifest.forEach((metadata, index) =>
    register({ ...metadata, component: supplied[suppliedIconKeys[index]!] }),
  );
  custom.forEach(register);
  return {
    register,
    resolve(pack: string, name: string, revision: string) {
      return entries.get(identity(pack, name, revision));
    },
    search(query = '', offset = 0, limit = 20) {
      if (
        !Number.isInteger(offset) ||
        offset < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 40 ||
        query.length > 100
      )
        throw Error('Icon search requires offset >= 0, limit 1–40 and query <=100 characters.');
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const filtered = [...entries.values()].filter((e) =>
        terms.every((term) =>
          `${e.pack} ${e.name} ${e.label} ${e.tags.join(' ')}`.toLowerCase().includes(term),
        ),
      );
      return {
        items: filtered
          .slice(offset, offset + limit)
          .map(({ component: _component, vector: _vector, ...metadata }) => metadata),
        total: filtered.length,
        nextOffset: offset + limit < filtered.length ? offset + limit : null,
      };
    },
    exportCustom() {
      return [...entries.values()]
        .filter((e) => e.vector)
        .map(({ component: _component, ...entry }) => entry);
    },
  };
}
export type IconRegistry = ReturnType<typeof createIconRegistry>;
export function importCustomIconPack(value: unknown): readonly IconEntry[] {
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { schema?: unknown }).schema !== 'vict.icon-pack@1' ||
    !Array.isArray((value as { icons?: unknown }).icons)
  )
    throw Error('Expected vict.icon-pack@1.');
  const icons = (value as { icons: IconEntry[] }).icons;
  if (icons.length > 200) throw Error('A custom icon pack supports at most 200 icons.');
  return icons.map((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Object.keys(entry).some(
        (key) =>
          ![
            'pack',
            'name',
            'revision',
            'label',
            'tags',
            'license',
            'provenance',
            'vector',
          ].includes(key),
      ) ||
      !Array.isArray(entry.tags) ||
      entry.tags.some((tag) => typeof tag !== 'string' || tag.length > 80)
    )
      throw Error('Invalid custom icon metadata.');
    return { ...entry, vector: validateVector(entry.vector) };
  });
}
