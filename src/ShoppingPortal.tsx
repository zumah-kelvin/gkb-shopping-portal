import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { relaySupabase, relaySupabaseConfigError } from './supabase';
import OrdersPortal from './OrdersPortal';
import {
  ShoppingBag, Laptop, Package, Shield, Phone, Mail, Globe,
  User, Lock, LogOut, CheckCircle, AlertTriangle, ArrowRight,
  Sun, Moon, Zap, Tag, RefreshCw, PlusCircle, Search, Filter,
  Smartphone, HardDrive, Layers, Cpu, Copy, Check, Info,
  SlidersHorizontal, Sparkles, Folder, Pencil, DollarSign, X,
  Store, BadgeCheck, Building, Trash2, ChevronLeft, ChevronRight,
  Flame, Pause, Play
} from 'lucide-react';

export type ProductCategory = 'laptops' | 'phones' | 'gadgets';

type UserType = {
  id: string;
  role: 'admin' | 'vendor' | 'client';
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  location: string;
  businessName?: string;
};

type InventoryItem = {
  id: string;
  brand: string;
  title: string;
  highlights: string;
  price: number;
  ram: string;
  storage: string;
  image_path: string;
  active: boolean;
  category?: ProductCategory;
  gadgetType?: string;
  vendorId?: string;
  vendorName?: string;
  vendorPhone?: string;
  isOfficial?: boolean;
};

// ================= BRAND & SPEC PRESETS =================
const laptopBrandOptions = ['HP', 'Dell', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Toshiba', 'MSI', 'Samsung', 'Microsoft Surface', 'Other (Custom Brand)'];
const laptopRamOptions = ['4GB', '8GB', '16GB', '32GB', '64GB'];
const laptopStorageOptions = ['128GB', '256GB', '512GB', '1TB', '2TB', '4TB'];

const phoneBrandOptions = ['Apple (iPhone)', 'Samsung', 'Tecno', 'Infinix', 'Google Pixel', 'Xiaomi / Redmi', 'Huawei', 'Oppo', 'Vivo', 'OnePlus', 'Other (Custom Brand)'];
const phoneStorageOptions = ['64GB', '128GB', '256GB', '512GB', '1TB'];
const phoneRamOptions = ['3GB', '4GB', '6GB', '8GB', '12GB', '16GB'];

const gadgetTypeOptions = [
  'External Hard Drive / SSD',
  'Laptop Stand / Cooling Pad',
  'Wireless Mouse / Keyboard',
  'Power Bank / Fast Charger',
  'USB-C Hub / Docking Station',
  'Headphones & Bluetooth Audio',
  'Smart IoT & Development Board',
  'Other Electronic Gadget'
];
const gadgetBrandOptions = ['Logitech', 'SanDisk', 'Seagate', 'Western Digital', 'Anker', 'Oraimo', 'Baseus', 'Apple Accessories', 'Samsung Gear', 'GKB Prototyping', 'Other (Custom Brand)'];
const gadgetCapacityOptions = ['None / N/A', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB', '4TB', '5TB', '10,000 mAh', '20,000 mAh', '30,000 mAh'];

const inventoryImageBucket = 'gkb-device-images';

// Category parsing helper for backward compatibility with database rows
export function parseCategory(item: { category?: string; title?: string; brand?: string; highlights?: string }): ProductCategory {
  // 1. Explicit native category column
  if (item.category && typeof item.category === 'string') {
    const c = item.category.trim().toLowerCase();
    if (c === 'phones' || c === 'phone' || c.includes('mobile')) return 'phones';
    if (c === 'gadgets' || c === 'gadget' || c.includes('accessory')) return 'gadgets';
    if (c === 'laptops' || c === 'laptop' || c.includes('computer')) return 'laptops';
  }

  // 2. Check for explicit [Category: ...] tag in highlights
  const h = item.highlights || '';
  const catTagMatch = h.match(/\[\s*category\s*:\s*([^|\]]+)/i);
  if (catTagMatch && catTagMatch[1]) {
    const tag = catTagMatch[1].trim().toLowerCase();
    if (tag.includes('phone') || tag.includes('mobile')) return 'phones';
    if (tag.includes('gadget') || tag.includes('accessory')) return 'gadgets';
    if (tag.includes('laptop') || tag.includes('computer')) return 'laptops';
  }

  const title = (item.title || '').toLowerCase();
  const brand = (item.brand || '').toLowerCase();
  const highlights = h.toLowerCase();

  // 3. Check for Mobile Phones (Title, Brand, Model names)
  const phoneKeywords = [
    'iphone', 'smartphone', 'samsung galaxy', 'tecno', 'infinix',
    'google pixel', 'xiaomi', 'redmi', 'oppo', 'vivo', 'realme',
    'oneplus', 'galaxy s', 'galaxy a', 'galaxy note', 'galaxy z'
  ];
  if (phoneKeywords.some(kw => title.includes(kw) || brand.includes(kw))) {
    return 'phones';
  }

  // 4. Check for standalone Electronic Gadgets & Peripherals (in Title & Brand ONLY)
  // CRITICAL: Do NOT check 'ssd', 'hdd', or 'keyboard' in highlights, because every laptop has an SSD and keyboard!
  const gadgetTitleKeywords = [
    'stand', 'cooling pad', 'laptop stand', 'holder', 'mount',
    'external hard drive', 'external hdd', 'portable ssd', 'backup plus',
    'flash drive', 'thumb drive', 'usb drive', 'pen drive',
    'mouse', 'wireless mouse', 'gaming mouse',
    'power bank', 'charger', 'fast charger', 'charging cable',
    'usb-c hub', 'docking station', 'dongle',
    'headphone', 'headphones', 'earbud', 'earbuds', 'airpod', 'speaker',
    'smartwatch', 'smart watch', 'fitness band',
    'esp32', 'arduino', 'raspberry pi', 'starter kit', 'sensor module', 'iot kit'
  ];
  const gadgetBrands = [
    'seagate', 'western digital', 'sandisk', 'logitech', 'anker',
    'baseus', 'oraimo', 'ugreen', 'jbl', 'tp-link', 'gkb prototyping'
  ];

  const isPureGadgetBrand = gadgetBrands.some(gb => brand.includes(gb));
  const isGadgetTitle = gadgetTitleKeywords.some(kw => title.includes(kw));

  // If title is "Stand", "Lapto Stand", "Logitech Mouse", etc.
  if (isGadgetTitle || (isPureGadgetBrand && !title.includes('laptop') && !title.includes('notebook') && !title.includes('elitebook') && !title.includes('latitude'))) {
    return 'gadgets';
  }

  // 5. Check for Laptops & Computers (Brands, Models, Workstations, Desktops)
  const laptopTerms = [
    'latitude', 'precision', 'thinkpad', 'ideapad', 'elitebook', 'probook',
    'spectre', 'envy', 'pavilion', 'macbook', 'zenbook', 'vivobook',
    'surface', 'inspiron', 'vostro', 'xps', 'alienware', 'legion',
    'omen', 'predator', 'yoga', 'swift', 'aspire', 'satellite',
    'chromebook', 'notebook', 'workstation', 'desktop', 'all-in-one',
    'eliteone', 'optiplex', 'prodesk', 'laptop', 'core i3', 'core i5',
    'core i7', 'core i9', 'intel', 'ryzen', 'amd', 'quadcore',
    'x360', 'convertible', 'generation', 'touchscreen'
  ];
  if (laptopTerms.some(term => title.includes(term) || brand.includes(term) || highlights.includes(term))) {
    return 'laptops';
  }

  // Default fallback for GKB inventory is laptops
  return 'laptops';
}

export function parseGadgetType(itemOrHighlights: string | { title?: string; brand?: string; highlights?: string }): string {
  const highlights = typeof itemOrHighlights === 'string' ? itemOrHighlights : (itemOrHighlights.highlights || '');
  const title = typeof itemOrHighlights === 'string' ? '' : (itemOrHighlights.title || '');
  const brand = typeof itemOrHighlights === 'string' ? '' : (itemOrHighlights.brand || '');

  // 1. Check explicit Type tag in highlights
  const match = highlights.match(/\[Category:[^|\]]*\|\s*Type:\s*([^\]]+)\]/i);
  if (match && match[1]) return match[1].trim();

  // 2. Check title, brand, and highlights
  const text = `${title} ${brand} ${highlights}`.toLowerCase();
  if (text.includes('stand') || text.includes('cooling pad') || text.includes('posture') || text.includes('holder')) {
    return 'Laptop Stand / Cooling Pad';
  }
  if (text.includes('external') || text.includes('portable') || text.includes('backup plus') || text.includes('flash drive') || text.includes('hard drive') || text.includes('thumb drive')) {
    return 'External Hard Drive / SSD';
  }
  if (text.includes('mouse') || (text.includes('keyboard') && !text.includes('keyboard light') && !text.includes('backlit'))) {
    return 'Wireless Mouse / Keyboard';
  }
  if (text.includes('power bank') || text.includes('charger') || text.includes('adapter') || text.includes('cable')) {
    return 'Power Bank / Fast Charger';
  }
  if (text.includes('hub') || text.includes('dock') || text.includes('dongle')) {
    return 'USB-C Hub / Docking Station';
  }
  if (text.includes('headphone') || text.includes('earbud') || text.includes('audio') || text.includes('speaker') || text.includes('airpod')) {
    return 'Headphones & Audio';
  }
  if (text.includes('iot') || text.includes('esp32') || text.includes('arduino') || text.includes('sensor') || text.includes('starter kit')) {
    return 'Smart IoT & Hardware';
  }

  return 'Electronic Gadget';
}

// Canonical brand mapping and normalization
export function normalizeBrand(rawBrand?: string): string {
  if (!rawBrand) return 'Generic';
  const trimmed = rawBrand.trim();
  const lower = trimmed.toLowerCase();

  const CANONICAL_MAP: Record<string, string> = {
    'dell': 'Dell',
    'hp': 'HP',
    'hewlett-packard': 'HP',
    'lenovo': 'Lenovo',
    'apple': 'Apple',
    'asus': 'ASUS',
    'acer': 'Acer',
    'toshiba': 'Toshiba',
    'samsung': 'Samsung',
    'microsoft': 'Microsoft',
    'microsoft surface': 'Microsoft Surface',
    'msi': 'MSI',
    'razer': 'Razer',
    'sony': 'Sony',
    'google': 'Google',
    'google pixel': 'Google Pixel',
    'oneplus': 'OnePlus',
    'xiaomi': 'Xiaomi',
    'redmi': 'Xiaomi',
    'poco': 'Poco',
    'tecno': 'Tecno',
    'infinix': 'Infinix',
    'huawei': 'Huawei',
    'oppo': 'OPPO',
    'vivo': 'vivo',
    'motorola': 'Motorola',
    'nokia': 'Nokia',
    'honor': 'Honor',
    'realme': 'realme',
    'logitech': 'Logitech',
    'seagate': 'Seagate',
    'sandisk': 'SanDisk',
    'western digital': 'Western Digital',
    'wd': 'WD',
    'anker': 'Anker',
    'baseus': 'Baseus',
    'ugreen': 'Ugreen',
    'orico': 'Orico',
    'kingston': 'Kingston',
    'transcend': 'Transcend',
    'crucial': 'Crucial',
    'corsair': 'Corsair',
    'jbl': 'JBL',
    'bose': 'Bose',
    'lapto stand': 'Laptop Stand',
    'laptop stand': 'Laptop Stand'
  };

  if (CANONICAL_MAP[lower]) {
    return CANONICAL_MAP[lower];
  }

  // Capitalize each word properly if not in map
  return trimmed
    .split(/\s+/)
    .map(w => (w.length <= 1 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

// Clean highlights text by stripping internal metadata tags for display
export function cleanHighlights(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[\s*Category:[^\]]*\]\s*/gi, '')
    .replace(/\[\s*Vendor:[^\]]*\]\s*/gi, '')
    .replace(/\[\s*Spec\s*RAM:[^\]]*\]\s*/gi, '')
    .replace(/\[\s*Spec\s*Storage:[^\]]*\]\s*/gi, '')
    .trim();
}

// Vendor parsing helper for multi-vendor marketplace
export function parseVendor(item: { highlights?: string; vendor_id?: string; vendor_name?: string; vendor_phone?: string;[key: string]: any }): {
  vendorId?: string;
  vendorName: string;
  vendorPhone: string;
  isOfficial: boolean;
} {
  if (item.vendor_name) {
    const isGkb = item.vendor_name.toLowerCase().includes('gkb') || item.vendor_name.toLowerCase().includes('official');
    return {
      vendorId: item.vendor_id,
      vendorName: item.vendor_name,
      vendorPhone: item.vendor_phone || '0552117787',
      isOfficial: isGkb
    };
  }
  const match = item.highlights?.match(/\[Vendor:\s*([^|\]]+)(?:\s*\|\s*Phone:\s*([^|\]]+))?(?:\s*\|\s*UID:\s*([^|\]]+))?\]/i);
  if (match) {
    const vName = match[1]?.trim() || 'Verified Vendor';
    const isGkb = vName.toLowerCase().includes('gkb') || vName.toLowerCase().includes('official');
    return {
      vendorName: vName,
      vendorPhone: match[2]?.trim() || '0552117787',
      vendorId: match[3]?.trim(),
      isOfficial: isGkb
    };
  }
  return {
    vendorName: 'GKB Official Store',
    vendorPhone: '0552117787',
    isOfficial: true
  };
}

// ================= INITIAL DEMO PRODUCTS =================
const initialDemoProducts: InventoryItem[] = [
  // Laptops
  {
    id: 'demo-1',
    category: 'laptops',
    brand: 'HP',
    title: 'HP EliteBook 840 G7 · Core i7 10th Gen',
    highlights: 'Ultra-slim business flagship. 14.0" FHD IPS anti-glare display, premium aluminum chassis, Bang & Olufsen tuned audio, backlit spill-resistant keyboard, Wi-Fi 6, USB-C Thunderbolt 3.',
    price: 3600.00,
    ram: '16GB',
    storage: '512GB',
    image_path: '',
    active: true
  },
  {
    id: 'demo-2',
    category: 'laptops',
    brand: 'Dell',
    title: 'Dell Latitude 5420 · Intel Core i5 11th Gen',
    highlights: 'High-end engineering and productivity workstation. ExpressCharge rapid power, Intel Iris Xe graphics, dual array microphones, full port array including HDMI 2.0 & Thunderbolt 4.',
    price: 3400.00,
    ram: '16GB',
    storage: '256GB',
    image_path: '',
    active: true
  },
  {
    id: 'demo-3',
    category: 'laptops',
    brand: 'Lenovo',
    title: 'Lenovo ThinkPad T14 Gen 2 · Core i7 Heavy Duty',
    highlights: 'Legendary military-grade durability. Ergonomic TrackPoint keyboard, fingerprint biometric reader, 50Wh extended battery life, robust dual heat pipe thermal cooling.',
    price: 4200.00,
    ram: '32GB',
    storage: '512GB',
    image_path: '',
    active: true
  },
  {
    id: 'demo-4',
    category: 'laptops',
    brand: 'Apple',
    title: 'MacBook Air M1 · Retina True Tone Display',
    highlights: 'Apple M1 Silicon 8-core CPU with extraordinary power efficiency. Silent fanless design, up to 18 hours battery life, P3 wide color gamut, Magic Keyboard with Touch ID.',
    price: 5800.00,
    ram: '8GB',
    storage: '256GB',
    image_path: '',
    active: true
  },
  // Mobile Phones
  {
    id: 'demo-phone-1',
    category: 'phones',
    brand: 'Apple',
    title: 'iPhone 13 Pro · 128GB Sierra Blue',
    highlights: '[Category: Mobile Phones]\nApple A15 Bionic chip, 6.1" Super Retina XDR with ProMotion 120Hz, Triple 12MP Pro camera system with LiDAR scanner, Ceramic Shield front, 5G cellular, Battery Health 91%. Clean UK used.',
    price: 5200.00,
    ram: 'N/A',
    storage: '128GB',
    image_path: '',
    active: true
  },
  {
    id: 'demo-phone-2',
    category: 'phones',
    brand: 'Samsung',
    title: 'Samsung Galaxy S22 Ultra 5G · 256GB Phantom Black',
    highlights: '[Category: Mobile Phones]\nSnapdragon 8 Gen 1 processor, 6.8" Dynamic AMOLED 2X, Embedded S-Pen stylus, 108MP Quad Camera with 100x Space Zoom, 5,000mAh battery with 45W fast charging, Dual SIM.',
    price: 5500.00,
    ram: 'N/A',
    storage: '256GB',
    image_path: '',
    active: true
  },
  {
    id: 'demo-phone-3',
    category: 'phones',
    brand: 'Tecno',
    title: 'Tecno Camon 30 Pro 5G · 256GB Space Silver',
    highlights: '[Category: Mobile Phones]\nMediaTek Dimensity 8200 Ultimate 5G chip, 50MP Sony IMX890 OIS camera, 144Hz 1.5K AMOLED curved display, 70W Ultra Charge with 5,000mAh battery, Dolby Atmos stereo dual speakers.',
    price: 2950.00,
    ram: 'N/A',
    storage: '256GB',
    image_path: '',
    active: true
  },
  // Electronic Gadgets & Accessories
  {
    id: 'demo-gadget-1',
    category: 'gadgets',
    gadgetType: 'External Hard Drive / SSD',
    brand: 'Seagate',
    title: 'Seagate 2TB Backup Plus USB 3.0 External Hard Drive',
    highlights: '[Category: Electronic Gadgets | Type: External Hard Drive / SSD]\nHigh-speed USB 3.0 connectivity with plug-and-play setup for PC & Mac. Brushed metal aluminum finish, compact portable form factor, included Seagate Toolkit automated backup software.',
    price: 650.00,
    ram: 'N/A',
    storage: '2TB',
    image_path: '',
    active: true
  },
  {
    id: 'demo-gadget-2',
    category: 'gadgets',
    gadgetType: 'Laptop Stand / Cooling Pad',
    brand: 'GKB Prototyping',
    title: 'Ergonomic Foldable Aluminum Laptop Stand (Dual Cooling Fans)',
    highlights: '[Category: Electronic Gadgets | Type: Laptop Stand / Cooling Pad]\nPremium aircraft-grade aluminum alloy, 6 adjustable ergonomic height angles, twin silent blue LED cooling fans with USB power pass-through, anti-slip silicone rubber pads. Supports 10" to 17.3" laptops.',
    price: 220.00,
    ram: 'N/A',
    storage: 'None',
    image_path: '',
    active: true
  },
  {
    id: 'demo-gadget-3',
    category: 'gadgets',
    gadgetType: 'Wireless Mouse / Keyboard',
    brand: 'Logitech',
    title: 'Logitech MX Master 3S Wireless Performance Mouse',
    highlights: '[Category: Electronic Gadgets | Type: Wireless Mouse / Keyboard]\nAny-surface 8,000 DPI Darkfield tracking including glass, Quiet Click acoustic dampening, MagSpeed electromagnetic scroll wheel (1,000 lines/sec), USB-C quick charge with 70 days battery life, Bluetooth & Logi Bolt.',
    price: 580.00,
    ram: 'N/A',
    storage: 'None',
    image_path: '',
    active: true
  },
  {
    id: 'demo-gadget-4',
    category: 'gadgets',
    gadgetType: 'Smart IoT & Development Board',
    brand: 'GKB Prototyping',
    title: 'GKB IoT Prototyping Starter Kit · ESP32 + Sensor Suite',
    highlights: '[Category: Electronic Gadgets | Type: Smart IoT & Development Board]\nComplete student & engineer development package. Includes ESP32 DevKit NodeMCU, 0.96" I2C OLED display, DHT22 environmental sensor, PIR motion detector, ultrasonic rangefinder, and 4-channel relay controller module.',
    price: 650.00,
    ram: '4GB',
    storage: '128GB',
    image_path: '',
    active: true
  }
];

function InventoryHighlights({ text }: { text: string }) {
  const measurementRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const [collapsedHeight, setCollapsedHeight] = useState(0);

  const cleanText = cleanHighlights(text);

  useEffect(() => {
    const measurement = measurementRef.current;
    if (!measurement) return;

    const updateMeasurements = () => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(measurement).lineHeight);
      const nextCollapsedHeight = (Number.isFinite(lineHeight) ? lineHeight : 24) * 3;
      const nextFullHeight = measurement.scrollHeight;
      setCollapsedHeight(nextCollapsedHeight);
      setFullHeight(nextFullHeight);
      setHasMore(nextFullHeight > nextCollapsedHeight + 1);
    };

    updateMeasurements();
    const observer = new ResizeObserver(updateMeasurements);
    observer.observe(measurement);
    return () => observer.disconnect();
  }, [cleanText]);

  return (
    <div className="relative">
      <p
        aria-hidden="true"
        ref={measurementRef}
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 whitespace-pre-line text-sm leading-relaxed opacity-0"
      >
        {cleanText}
      </p>
      <p
        className="overflow-hidden whitespace-pre-line text-sm leading-relaxed text-slate-400 transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: `${expanded ? fullHeight : collapsedHeight}px` }}
      >
        {cleanText}
      </p>
      {hasMore && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
          className="mt-2 text-xs font-semibold text-cyan-300 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          {expanded ? 'See Less' : 'See More'}
        </button>
      )}
    </div>
  );
}

export default function ShoppingPortal() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'order' | 'my-orders' | 'admin-inventory' | 'contact'>('catalog');
  const [isLightMode, setIsLightMode] = useState(
    () => window.localStorage.getItem('gkb-theme') === 'light'
  );
  const [user, setUser] = useState<UserType | null>(null);
  const isAdmin = Boolean(user && (user.role === 'admin' || user.email?.toLowerCase() === 'zumkel023@gmail.com'));
  const isVendor = Boolean(user && user.role === 'vendor');
  const canManageInventory = isAdmin || isVendor;

  // Price editing state (Strictly Admin Only)
  // Multi-Vendor filter on catalog
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('all');

  // Multi-Vendor registration state
  const [signupAccountType, setSignupAccountType] = useState<'client' | 'vendor'>('client');
  const [signupBusinessName, setSignupBusinessName] = useState('');

  // Admin: assign product to vendor or GKB Official
  const [vendorAssignment, setVendorAssignment] = useState('GKB Official Store');
  const [vendorCustomAssignName, setVendorCustomAssignName] = useState('');
  const [vendorCustomAssignPhone, setVendorCustomAssignPhone] = useState('');

  // Price editing state (Admin or Item Owner Vendor)
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [priceSavingId, setPriceSavingId] = useState<string | null>(null);
  const [priceEditError, setPriceEditError] = useState<string>('');
  const [priceEditSuccess, setPriceEditSuccess] = useState<string>('');

  // Product deletion state (Admin confirmation)
  const [deletingProduct, setDeletingProduct] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupLocation, setSignupLocation] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Search & Categories Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all');
  const [selectedGadgetType, setSelectedGadgetType] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedOrderProduct, setSelectedOrderProduct] = useState('');
  const [selectedOrderPrice, setSelectedOrderPrice] = useState<number | null>(null);

  // Inventory state
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [inventoryMessage, setInventoryMessage] = useState('');
  const [sqlCopied, setSqlCopied] = useState(false);
  const [showSqlHelper, setShowSqlHelper] = useState(false);

  // Jumia-style daily advertising banner carousel state (at least 10 products, shuffle between phone, gadget, laptop)
  const [adSlideIndex, setAdSlideIndex] = useState(0);
  const [isAdPaused, setIsAdPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  // Memoized daily advertised products: at least 10 products, daily shuffled and alternating round-robin between phones, laptops, and gadgets
  const advertisedProducts = React.useMemo(() => {
    const activePool = inventoryItems.filter(item => item.active);
    const sourcePool = activePool.length > 0 ? activePool : initialDemoProducts;

    const laptops = sourcePool.filter(i => (i.category || parseCategory(i)) === 'laptops');
    const phones = sourcePool.filter(i => (i.category || parseCategory(i)) === 'phones');
    const gadgets = sourcePool.filter(i => (i.category || parseCategory(i)) === 'gadgets');

    // Deterministic daily shuffle seed derived from current date (YYYY-MM-DD)
    const todayStr = new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (let i = 0; i < todayStr.length; i++) {
      seed = ((seed * 31) + todayStr.charCodeAt(i)) & 0xffffffff;
    }

    const shuffleArray = <T,>(arr: T[], s: number): T[] => {
      const copy = [...arr];
      let currentSeed = s;
      for (let i = copy.length - 1; i > 0; i--) {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        const rnd = currentSeed / 233280;
        const j = Math.floor(rnd * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const shuffledPhones = shuffleArray(phones.length > 0 ? phones : sourcePool, seed + 101);
    const shuffledLaptops = shuffleArray(laptops.length > 0 ? laptops : sourcePool, seed + 202);
    const shuffledGadgets = shuffleArray(gadgets.length > 0 ? gadgets : sourcePool, seed + 303);

    // Round-robin interleave: Phone -> Laptop -> Gadget -> Phone -> Laptop -> Gadget...
    const interleaved: InventoryItem[] = [];
    const maxLen = Math.max(shuffledPhones.length, shuffledLaptops.length, shuffledGadgets.length, 4);

    for (let i = 0; i < maxLen; i++) {
      if (shuffledPhones.length > 0) interleaved.push(shuffledPhones[i % shuffledPhones.length]);
      if (shuffledLaptops.length > 0) interleaved.push(shuffledLaptops[i % shuffledLaptops.length]);
      if (shuffledGadgets.length > 0) interleaved.push(shuffledGadgets[i % shuffledGadgets.length]);
    }

    // Deduplicate unique items first up to 10
    const result: InventoryItem[] = [];
    const seenIds = new Set<string>();

    for (const item of interleaved) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        result.push(item);
      }
      if (result.length >= 10) break;
    }

    // Ensure there are at least 10 advertised items daily by cycling if fewer than 10 unique exist
    let cycleIndex = 0;
    while (result.length < 10 && interleaved.length > 0) {
      result.push(interleaved[cycleIndex % interleaved.length]);
      cycleIndex++;
    }

    return result.slice(0, 10);
  }, [inventoryItems]);

  // Next / Previous slide handlers
  const nextAdSlide = useCallback(() => {
    setAdSlideIndex(curr => (curr + 1) % Math.max(1, advertisedProducts.length));
  }, [advertisedProducts.length]);

  const prevAdSlide = useCallback(() => {
    setAdSlideIndex(curr => (curr - 1 + Math.max(1, advertisedProducts.length)) % Math.max(1, advertisedProducts.length));
  }, [advertisedProducts.length]);

  // Touch gesture handlers for mobile swipe left / right
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null) {
      if (touchDeltaX.current < -40) {
        // Swiped Left -> Advance to next ad slide
        nextAdSlide();
      } else if (touchDeltaX.current > 40) {
        // Swiped Right -> Back to previous ad slide
        prevAdSlide();
      }
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  // Auto-advance interval (swipe left effect every 4.5 seconds like Jumia)
  useEffect(() => {
    if (advertisedProducts.length <= 1 || isAdPaused) return;

    const timer = setInterval(() => {
      setAdSlideIndex(curr => (curr + 1) % advertisedProducts.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [advertisedProducts.length, isAdPaused]);

  // Ownership helper: Admin owns all, Vendor owns their own uploads
  const isItemOwner = (item: InventoryItem) => {
    if (isAdmin) return true;
    if (!isVendor || !user) return false;
    if (item.vendorId && item.vendorId === user.id) return true;
    const vName = item.vendorName?.toLowerCase().trim();
    const bName = user.businessName?.toLowerCase().trim();
    const uName = `${user.firstName} ${user.lastName}`.toLowerCase().trim();
    return Boolean((bName && vName === bName) || (uName && vName === uName));
  };

  // Admin Upload Form State
  const [inventoryCategory, setInventoryCategory] = useState<ProductCategory>('laptops');
  const [inventoryBrandSelect, setInventoryBrandSelect] = useState('HP');
  const [inventoryCustomBrand, setInventoryCustomBrand] = useState('');
  const [inventoryTitle, setInventoryTitle] = useState('');
  const [inventoryHighlights, setInventoryHighlights] = useState('');
  const [inventoryPrice, setInventoryPrice] = useState('');
  const [inventoryRam, setInventoryRam] = useState(laptopRamOptions[2]); // 16GB
  const [inventoryStorage, setInventoryStorage] = useState(laptopStorageOptions[2]); // 512GB
  const [inventoryGadgetType, setInventoryGadgetType] = useState(gadgetTypeOptions[0]);
  const [inventoryGadgetCapacity, setInventoryGadgetCapacity] = useState(gadgetCapacityOptions[0]);
  const [inventoryImage, setInventoryImage] = useState<File | null>(null);

  // Smart WhatsApp / Supplier Text Parser State
  const [smartParseText, setSmartParseText] = useState('');
  const [smartParseSuccess, setSmartParseSuccess] = useState<string | null>(null);
  const [smartParseDetails, setSmartParseDetails] = useState<string[]>([]);
  const [smartParseError, setSmartParseError] = useState<string | null>(null);
  const [showSmartParser, setShowSmartParser] = useState(true);

  useEffect(() => {
    window.localStorage.setItem('gkb-theme', isLightMode ? 'light' : 'dark');
  }, [isLightMode]);

  // Auth session management
  const applyPortalSession = useCallback(async (session: Session | null) => {
    if (!session?.user.email && !session?.user.phone) {
      setUser(null);
      return;
    }

    const metadata = (session.user.user_metadata || {}) as Record<string, any>;
    const account: UserType = {
      id: session.user.id,
      role: 'client',
      email: session.user.email ?? session.user.phone ?? '',
      firstName: typeof metadata.first_name === 'string' ? metadata.first_name : '',
      lastName: typeof metadata.last_name === 'string' ? metadata.last_name : '',
      phone: typeof metadata.phone === 'string' ? metadata.phone : '',
      location: typeof metadata.location === 'string' ? metadata.location : '',
      businessName: typeof metadata.business_name === 'string' ? metadata.business_name : ''
    };
    if (!relaySupabase) {
      setUser(account);
      return;
    }

    const { data } = await relaySupabase
      .from('gkb_user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const isExplicitAdmin = data?.role === 'admin' || session.user.email?.toLowerCase() === 'zumkel023@gmail.com';
    const isExplicitVendor = data?.role === 'vendor' || metadata?.role === 'vendor' || metadata?.is_vendor === true;
    const role: 'admin' | 'vendor' | 'client' = isExplicitAdmin ? 'admin' : isExplicitVendor ? 'vendor' : 'client';
    setUser({ ...account, role });
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem('gkb_client_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as UserType;
        if (parsed && (parsed.email || parsed.phone)) {
          setUser(parsed);
        }
      } catch {
        // ignore
      }
    }

    if (!relaySupabase) return;
    const { data: { subscription } } = relaySupabase.auth.onAuthStateChange((_event, session) => {
      void applyPortalSession(session);
    });
    void relaySupabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void applyPortalSession(data.session);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [applyPortalSession]);

  // Load Inventory from Supabase
  const loadInventory = useCallback(async () => {
    if (!relaySupabase) {
      setInventoryItems(initialDemoProducts);
      return;
    }
    setInventoryLoading(true);
    setInventoryError('');
    try {
      const { data, error } = await relaySupabase
        .from('gkb_inventory_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Unable to load from Supabase gkb_inventory_items, using seed catalog.', error);
        setInventoryItems(initialDemoProducts);
      } else if (data && data.length > 0) {
        setInventoryItems(data.map(item => {
          const category = parseCategory(item);
          const gadgetType = category === 'gadgets' ? parseGadgetType(item) : undefined;
          const vendor = parseVendor(item);
          const specRamMatch = item.highlights?.match(/\[Spec\s*RAM:\s*([^\]]+)\]/i);
          const specStorageMatch = item.highlights?.match(/\[Spec\s*Storage:\s*([^\]]+)\]/i);
          return {
            ...item,
            brand: normalizeBrand(item.brand),
            price: Number(item.price),
            category,
            gadgetType,
            ram: specRamMatch ? specRamMatch[1].trim() : item.ram,
            storage: specStorageMatch ? specStorageMatch[1].trim() : item.storage,
            vendorId: vendor.vendorId || item.vendor_id,
            vendorName: vendor.vendorName,
            vendorPhone: vendor.vendorPhone,
            isOfficial: vendor.isOfficial
          } as InventoryItem;
        }));
      } else {
        setInventoryItems(initialDemoProducts);
      }
    } catch {
      setInventoryItems(initialDemoProducts);
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  // Auth actions
  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    setLoginMessage('');
    if (!relaySupabase) {
      setLoginError(relaySupabaseConfigError || 'Supabase is not configured.');
      return;
    }

    setLoginBusy(true);
    try {
      if (creatingAccount) {
        const isVendorSignup = signupAccountType === 'vendor';
        const { data, error } = await relaySupabase.auth.signUp({
          email: loginEmail.trim(),
          password: loginPassword,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              first_name: signupFirstName.trim(),
              last_name: signupLastName.trim(),
              phone: signupPhone.trim(),
              location: signupLocation.trim(),
              role: isVendorSignup ? 'vendor' : 'client',
              is_vendor: isVendorSignup,
              business_name: isVendorSignup ? signupBusinessName.trim() : undefined
            }
          }
        });
        if (error) throw error;

        const role: 'admin' | 'vendor' | 'client' = isVendorSignup ? 'vendor' : 'client';
        const clientAccount: UserType = {
          id: data.user?.id || ('client-' + Date.now()),
          role,
          email: loginEmail.trim(),
          firstName: signupFirstName.trim(),
          lastName: signupLastName.trim(),
          phone: signupPhone.trim(),
          location: signupLocation.trim(),
          businessName: isVendorSignup ? signupBusinessName.trim() : undefined
        };
        setUser(clientAccount);
        window.localStorage.setItem('gkb_client_session', JSON.stringify(clientAccount));
        if (isVendorSignup) {
          setActiveTab('admin-inventory');
        }
      } else {
        const identifier = loginEmail.trim();
        const credentials = identifier.includes('@')
          ? { email: identifier, password: loginPassword }
          : { phone: identifier, password: loginPassword };
        const { data, error } = await relaySupabase.auth.signInWithPassword(credentials);
        if (error) throw error;
        if (data.session) {
          await applyPortalSession(data.session);
        }
      }
      setLoginModalOpen(false);

      if (selectedOrderProduct) {
        setActiveTab('order');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Sign-in failed.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    if (relaySupabase) {
      await relaySupabase.auth.signOut();
    }
    window.localStorage.removeItem('gkb_client_session');
    setUser(null);
    setActiveTab('catalog');
  };

  // Add Inventory item (Admin)
  // Add Inventory item (Admin or Vendor)
  const handleAddInventoryItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInventoryError('');
    setInventoryMessage('');
    if ((!isAdmin && !isVendor) || !user || !relaySupabase) {
      setInventoryError('Only authorized administrators or registered vendors can add retail inventory.');
      return;
    }
      if (!inventoryImage) {
        setInventoryError('Please choose a product image to upload.');
        return;
      }
      const price = Number(inventoryPrice);
      if (!Number.isFinite(price) || price <= 0) {
        setInventoryError('Please enter a valid price greater than zero.');
        return;
      }

      const effectiveBrand = normalizeBrand(inventoryBrandSelect === 'Other (Custom Brand)'
        ? (inventoryCustomBrand.trim() || 'Custom Brand')
        : inventoryBrandSelect);

      setInventoryBusy(true);
      let uploadedImagePath: string | null = null;
      try {
        const ext = inventoryImage.type === 'image/jpeg' ? 'jpg' : inventoryImage.type === 'image/png' ? 'png' : 'webp';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await relaySupabase.storage
          .from(inventoryImageBucket)
          .upload(path, inventoryImage, { contentType: inventoryImage.type });
        if (uploadError) throw uploadError;
        uploadedImagePath = path;

        // Category metadata header embedded into highlights for zero-friction schema backward compatibility
        const categoryLabel = inventoryCategory === 'phones'
          ? 'Mobile Phones'
          : inventoryCategory === 'gadgets'
            ? 'Electronic Gadgets'
            : 'Laptops';

        const categoryTag = inventoryCategory === 'gadgets'
          ? `[Category: ${categoryLabel} | Type: ${inventoryGadgetType}${inventoryGadgetCapacity !== 'None / N/A' ? ` | Capacity: ${inventoryGadgetCapacity}` : ''}]`
          : `[Category: ${categoryLabel}]`;

        // Determine listing vendor
        const activeVendorName = isVendor
          ? (user.businessName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Verified Vendor')
          : (vendorAssignment === 'New Custom Vendor' ? (vendorCustomAssignName.trim() || 'Third-Party Vendor') : vendorAssignment);

        const activeVendorPhone = isVendor
          ? (user.phone || '0552117787')
          : (vendorAssignment === 'New Custom Vendor' ? (vendorCustomAssignPhone.trim() || '0552117787') : '0552117787');

        const activeVendorId = isVendor ? user.id : undefined;
        const isOfficialStore = activeVendorName.toLowerCase().includes('gkb') || activeVendorName.toLowerCase().includes('official');

        const vendorTag = isOfficialStore
          ? '[Vendor: GKB Official Store | Phone: 0552117787]'
          : `[Vendor: ${activeVendorName} | Phone: ${activeVendorPhone}${activeVendorId ? ` | UID: ${activeVendorId}` : ''}]`;

        // In case database has strict check constraint on ram/storage, provide fallback valid values
        const legacyAllowedRam = ['4GB', '8GB', '16GB', '32GB', '64GB'];
        const legacyAllowedStorage = ['128GB', '256GB', '512GB', '1TB', '2TB', '4TB'];

        const rawSelectedRam = (inventoryCategory === 'phones' || inventoryCategory === 'gadgets') ? 'N/A' : inventoryRam;
        const rawSelectedStorage = inventoryCategory === 'gadgets'
          ? (inventoryGadgetCapacity !== 'None / N/A' ? inventoryGadgetCapacity : 'N/A')
          : inventoryStorage;

        // Metadata tags to guarantee true requested specs are stored and displayed accurately
        const specTags = inventoryCategory === 'phones'
          ? `[Spec Storage: ${rawSelectedStorage}]`
          : `[Spec RAM: ${rawSelectedRam}][Spec Storage: ${rawSelectedStorage}]`;
        const enrichedHighlights = `${categoryTag}\n${vendorTag}\n${specTags}\n${inventoryHighlights.trim()}`;

        const preferredRam = (inventoryCategory === 'phones' || inventoryCategory === 'gadgets') ? '4GB' : inventoryRam;
        const preferredStorage = inventoryCategory === 'gadgets'
          ? (inventoryGadgetCapacity.includes('GB') || inventoryGadgetCapacity.includes('TB') ? inventoryGadgetCapacity : '128GB')
          : inventoryStorage;

        const safeFallbackRam = legacyAllowedRam.includes(preferredRam) ? preferredRam : '8GB';
        const safeFallbackStorage = legacyAllowedStorage.includes(preferredStorage) ? preferredStorage : '128GB';

        // Prepare insertion attempts: first with preferred, then with safe fallback if check constraint fires
        const ramCandidates = preferredRam === safeFallbackRam ? [preferredRam] : [preferredRam, safeFallbackRam];
        const storageCandidates = preferredStorage === safeFallbackStorage ? [preferredStorage] : [preferredStorage, safeFallbackStorage];

        let result: any = null;
        let lastError: any = null;

        for (const testRam of ramCandidates) {
          for (const testStorage of storageCandidates) {
            const basePayload = {
              brand: effectiveBrand,
              title: inventoryTitle.trim(),
              highlights: enrichedHighlights,
              price,
              ram: testRam,
              storage: testStorage,
              image_path: path
            };

            // Attempt 1: with all modern columns (category, vendor_id, vendor_name, vendor_phone)
            result = await relaySupabase
              .from('gkb_inventory_items')
              .insert({
                ...basePayload,
                category: inventoryCategory,
                vendor_id: activeVendorId,
                vendor_name: activeVendorName,
                vendor_phone: activeVendorPhone
              })
              .select()
              .single();

            if (!result.error) break;

            // Attempt 2: with only category column
            result = await relaySupabase
              .from('gkb_inventory_items')
              .insert({
                ...basePayload,
                category: inventoryCategory
              })
              .select()
              .single();

            if (!result.error) break;

            // Attempt 3: base legacy schema only
            result = await relaySupabase
              .from('gkb_inventory_items')
              .insert(basePayload)
              .select()
              .single();

            if (!result.error) break;

            lastError = result.error;
          }
          if (result && !result.error) break;
        }

        if (result?.error || !result?.data) {
          throw lastError || result?.error || new Error('Database insert failed.');
        }

        const data = result.data;

        const newItem: InventoryItem = {
          ...data,
          brand: normalizeBrand(data.brand || effectiveBrand),
          price: Number(data.price),
          category: inventoryCategory,
          gadgetType: inventoryCategory === 'gadgets' ? inventoryGadgetType : undefined,
          storage: rawSelectedStorage,
          ram: rawSelectedRam,
          vendorId: activeVendorId || data.vendor_id,
          vendorName: activeVendorName,
          vendorPhone: activeVendorPhone,
          isOfficial: isOfficialStore
        };

        setInventoryItems(current => [newItem, ...current]);
        setInventoryTitle('');
        setInventoryHighlights('');
        setInventoryPrice('');
        setInventoryCustomBrand('');
        setInventoryImage(null);
        setInventoryMessage(`${categoryLabel} published to live storefront under "${activeVendorName}" successfully!`);
      } catch (error: unknown) {
        console.error('Failed to add product:', error);
        let msg = 'Failed to add product.';
        if (error instanceof Error) {
          msg = error.message;
        } else if (typeof error === 'object' && error !== null) {
          const errObj = error as Record<string, any>;
          msg = errObj.message || errObj.error_description || errObj.details || JSON.stringify(error);
        }
        setInventoryError(`Could not publish product: ${msg}`);
      } finally {
        setInventoryBusy(false);
      }
    };

    // Archive item toggle (Admin or Item Owner Vendor)
    const handleToggleInventoryItem = async (item: InventoryItem) => {
      if (!isItemOwner(item) || !relaySupabase) return;
      try {
        const { data, error } = await relaySupabase
          .from('gkb_inventory_items')
          .update({ active: !item.active, updated_at: new Date().toISOString() })
          .eq('id', item.id)
          .select()
          .single();
        if (error) throw error;
        setInventoryItems(current => current.map(dev => dev.id === item.id ? { ...data, price: Number(data.price), category: item.category, gadgetType: item.gadgetType } as InventoryItem : dev));
        setInventoryItems(current => current.map(dev => dev.id === item.id ? { ...dev, ...data, price: Number(data.price) } as InventoryItem : dev));
      } catch (error) {
        console.error('Failed to update product state:', error);
      }
    };

    // Permanent Product Deletion (Admin Only with Confirmation)
    const handleConfirmDelete = async () => {
      if (!deletingProduct || !relaySupabase) return;
      if (!isAdmin) {
        setDeleteError('Only administrators can completely delete inventory items.');
        return;
      }

      setIsDeleting(true);
      setDeleteError('');

      try {
        // 1. Delete image file from Supabase storage if present
        if (deletingProduct.image_path) {
          try {
            await relaySupabase.storage
              .from(inventoryImageBucket)
              .remove([deletingProduct.image_path]);
          } catch {
            // ignore image remove failure
          }
        }

        // 2. Delete item from gkb_inventory_items in Supabase
        const { error } = await relaySupabase
          .from('gkb_inventory_items')
          .delete()
          .eq('id', deletingProduct.id);

        if (error) {
          console.warn('Permanent delete query error:', error);
          const msg = error.message || 'Permission denied or RLS policy missing for DELETE.';
          setDeleteError(`Database note: ${msg}. If RLS blocks DELETE, run the SQL helper in Manage Inventory to grant DELETE.`);
          setIsDeleting(false);
          return;
        }

        // 3. Update local state
        const deletedTitle = deletingProduct.title;
        setInventoryItems(current => current.filter(item => item.id !== deletingProduct.id));
        setDeletingProduct(null);
        setPriceEditSuccess(`"${deletedTitle}" was completely removed from the store and database.`);
        setTimeout(() => setPriceEditSuccess(''), 4500);
      } catch (err: unknown) {
        console.error('Delete product failed:', err);
        const msg = err instanceof Error ? err.message : 'Failed to delete product.';
        setDeleteError(msg);
      } finally {
        setIsDeleting(false);
      }
    };

      // Price editing handlers (Strictly Admin Only)
      // Price editing handlers (Admin or Item Owner Vendor)
      const handleStartEditPrice = (item: InventoryItem) => {
        if (!isAdmin) return;
        if (!isItemOwner(item)) return;
        setEditingPriceItemId(item.id);
        setEditPriceValue(item.price.toString());
        setPriceEditError('');
        setPriceEditSuccess('');
      };

      const handleCancelEditPrice = () => {
        setEditingPriceItemId(null);
        setEditPriceValue('');
        setPriceEditError('');
      };

      const handleSavePrice = async (item: InventoryItem) => {
        if (!isAdmin || !relaySupabase) return;
        if (!isItemOwner(item) || !relaySupabase) return;
        const newPrice = parseFloat(editPriceValue);
        if (isNaN(newPrice) || newPrice <= 0) {
          setPriceEditError('Please enter a valid positive price in GHS (e.g. 3500.00).');
          return;
        }
        setPriceSavingId(item.id);
        setPriceEditError('');
        try {
          const { data, error } = await relaySupabase
            .from('gkb_inventory_items')
            .update({
              price: newPrice,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id)
            .select()
            .single();

          if (error) throw error;

          setInventoryItems(current =>
            current.map(dev =>
              dev.id === item.id
                ? ({
                  ...dev,
                  ...data,
                  price: Number(data.price),
                  category: dev.category,
                  gadgetType: dev.gadgetType
                } as InventoryItem)
                : dev
            )
          );
          setEditingPriceItemId(null);
          setPriceEditSuccess(`Price for "${item.title}" successfully updated to GHS ${newPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}!`);
          setTimeout(() => setPriceEditSuccess(''), 4000);
        } catch (err: unknown) {
          console.error('Failed to update price:', err);
          const msg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err) ? String((err as { message: unknown }).message) : 'Failed to update price in Supabase.';
          setPriceEditError(msg);
        } finally {
          setPriceSavingId(null);
        }
      };

      const handleOrderProduct = (product: InventoryItem) => {
        setSelectedOrderProduct(product.title);
        setSelectedOrderPrice(product.price);

        if (!user) {
          setLoginError('');
          setLoginMessage(`Please sign in or create an account to proceed with ordering "${product.brand} ${product.title}".`);
          setLoginModalOpen(true);
          return;
        }

        setActiveTab('order');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      // Category switch helper for admin form
      const handleAdminCategoryChange = (cat: ProductCategory) => {
        setInventoryCategory(cat);
        if (cat === 'laptops') {
          setInventoryBrandSelect(laptopBrandOptions[0]);
          setInventoryRam(laptopRamOptions[2]); // 16GB
          setInventoryStorage(laptopStorageOptions[2]); // 512GB
        } else if (cat === 'phones') {
          setInventoryBrandSelect(phoneBrandOptions[0]);
          setInventoryRam('N/A');
          setInventoryStorage(phoneStorageOptions[1]); // 128GB
        } else {
          setInventoryBrandSelect(gadgetBrandOptions[0]);
          setInventoryGadgetType(gadgetTypeOptions[0]);
          setInventoryGadgetCapacity(gadgetCapacityOptions[5]); // 1TB
          setInventoryRam('N/A');
        }
      };

      // Smart Analyzer for WhatsApp broadcasts, supplier text, and raw specs
      const handleSmartParseSpecs = () => {
        if (!smartParseText.trim()) {
          setSmartParseError('Please paste some product specs or broadcast text first.');
          return;
        }
        setSmartParseError(null);
        setSmartParseSuccess(null);
        setSmartParseDetails([]);

        try {
          const rawLines = smartParseText
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);

          if (rawLines.length === 0) {
            setSmartParseError('No text lines found to analyze.');
            return;
          }

          const cleanLine = (s: string) => s.replace(/^[*_~•\-\s]+|[*_~•\-\s]+$/g, '').trim();
          const fullLower = smartParseText.toLowerCase();

          // 1. Detect Category
          let detectedCategory: ProductCategory = 'laptops';
          const isPhone = /\b(iphone|\d{1,2}\s*(?:pro\s*max|promax|pro|plus|mini)|pro\s*max|promax|esim|glacier|galaxy\s*[as]\d|redmi|infinix|tecno|pixel|huawei|oppo|vivo|oneplus|dual\s*sim|battery\s*health|bh\s*\d{2}%?|face\s*id|ios|factory\s*unlocked|jv\s*locked|sim\s*locked)\b|/i.test(fullLower);
          const isGadget = /\b(external\s*hard\s*drive|power\s*bank|portable\s*charger|cooling\s*pad|docking\s*station|wireless\s*mouse|wireless\s*keyboard|bluetooth\s*speaker|earbuds|headphones|smart\s*iot|smart\s*relay)\b/i.test(fullLower);
          const isLaptop = /\b(laptop|notebook|ultrabook|precision|thinkpad|elitebook|latitude|probook|macbook|x360|convertible|intel|core\s*i[3579]|ryzen|ddr[345]|touchscreen|fhd|ips|workstation)\b/i.test(fullLower);

          if (isLaptop) {
            detectedCategory = 'laptops';
          } else if (isPhone) {
            detectedCategory = 'phones';
          } else if (isGadget) {
            detectedCategory = 'gadgets';
          }

          // 2. Detect Brand
          let detectedBrand = 'Other (Custom Brand)';
          let detectedCustomBrand = '';

          const brandMatches: Array<{ brand: string; test: RegExp; category?: ProductCategory }> = [
            { brand: 'Dell', test: /\b(dell|precision|latitude|xps|inspiron|vostro|alienware)\b/i, category: 'laptops' },
            { brand: 'HP', test: /\b(hp|hewlett|elitebook|probook|omen|pavilion|spectre|envy)\b/i, category: 'laptops' },
            { brand: 'Lenovo', test: /\b(lenovo|thinkpad|ideapad|legion|yoga)\b/i, category: 'laptops' },
            { brand: 'Apple', test: /\b(macbook|imac|mac\s*mini|apple\s*silicon|m[1234])\b/i, category: 'laptops' },
            { brand: 'Apple (iPhone)', test: /\b(iphone|apple|\d{1,2}\s*(?:pro\s*max|promax|pro|plus|mini)|pro\s*max|promax|ios|bionic|esim)\b|/i, category: 'phones' },
            { brand: 'Samsung', test: /\b(samsung|galaxy)\b/i },
            { brand: 'Asus', test: /\b(asus|zenbook|vivobook|rog|tuf)\b/i, category: 'laptops' },
            { brand: 'Acer', test: /\b(acer|aspire|predator|nitro|swift)\b/i, category: 'laptops' },
            { brand: 'Toshiba', test: /\b(toshiba|dynabook)\b/i, category: 'laptops' },
            { brand: 'MSI', test: /\b(msi)\b/i, category: 'laptops' },
            { brand: 'Microsoft Surface', test: /\b(surface|microsoft\s*surface)\b/i, category: 'laptops' },
            { brand: 'Tecno', test: /\b(tecno|camon|spark|phantom)\b/i, category: 'phones' },
            { brand: 'Infinix', test: /\b(infinix|hot|note|zero)\b/i, category: 'phones' },
            { brand: 'Google Pixel', test: /\b(pixel|google\s*pixel)\b/i, category: 'phones' },
            { brand: 'Xiaomi / Redmi', test: /\b(xiaomi|redmi|poco)\b/i, category: 'phones' },
            { brand: 'Huawei', test: /\b(huawei)\b/i },
            { brand: 'Oppo', test: /\b(oppo)\b/i, category: 'phones' },
            { brand: 'Vivo', test: /\b(vivo)\b/i, category: 'phones' },
            { brand: 'OnePlus', test: /\b(oneplus)\b/i, category: 'phones' },
          ];

          for (const bm of brandMatches) {
            if (bm.test.test(fullLower)) {
              detectedBrand = bm.brand;
              if (bm.category && !isLaptop) {
                detectedCategory = bm.category;
              }
              break;
            }
          }

          // 3. Detect Price (typically near bottom or labeled with currency)
          let detectedPrice = '';
          let priceLineIndex = -1;

          // Bottom-up search for standalone or formatted numbers (stripping emojis like ‼️)
          for (let i = rawLines.length - 1; i >= 0; i--) {
            const lineClean = cleanLine(rawLines[i])
              .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}‼️!🔥💰✅🖊️💡❤️]/gu, '')
              .trim();
            const priceMatch = lineClean.match(/^(?:(?:ghs|gh₵|gh|cedis|price|¢)[:\s]*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,6})(?:\.00|\/-)?(?:\s*(?:ghs|gh₵|gh|cedis|¢))?$/i);
            if (priceMatch) {
              const val = priceMatch[1].replace(/,/g, '');
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 50 && num <= 250000) {
                detectedPrice = val;
                priceLineIndex = i;
                break;
              }
            }
          }

          // Fallback search anywhere in text for "GHS 4490" or "12800" etc.
          if (!detectedPrice) {
            const labeledMatch = fullLower.match(/(?:ghs|gh₵|gh|cedis|price|¢)[:\s]*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,6})/i);
            if (labeledMatch) {
              detectedPrice = labeledMatch[1].replace(/,/g, '');
            }
          }

          // 4. Detect RAM
          let detectedRam = '';
          const ramMatch = fullLower.match(/\b(4|6|8|12|16|24|32|64)\s*(?:gb|g)\s*(?:ddr[345]|ram|memory|lpddr[45])?\b/i);
          if (ramMatch) {
            const ramNum = ramMatch[1];
            if (detectedCategory === 'laptops') {
              const match = laptopRamOptions.find(o => o.startsWith(`${ramNum}GB`));
              detectedRam = match || `${ramNum}GB`;
            } else if (detectedCategory === 'phones') {
              const match = phoneRamOptions.find(o => o.startsWith(`${ramNum}GB`));
              detectedRam = match || `${ramNum}GB`;
            }
          } else if (detectedCategory === 'phones') {
            detectedRam = '6GB';
          }

          // 5. Detect Storage
          let detectedStorage = '';
          const storageMatch = fullLower.match(/\b(64|128|256|512)\s*gb\b|\b([124])\s*tb\b/i);
          if (storageMatch) {
            const cleanStorage = storageMatch[0].toUpperCase().replace(/\s+/g, '');
            if (detectedCategory === 'laptops') {
              const match = laptopStorageOptions.find(o => o === cleanStorage || o.startsWith(cleanStorage));
              detectedStorage = match || cleanStorage;
            } else if (detectedCategory === 'phones') {
              const match = phoneStorageOptions.find(o => o === cleanStorage || o.startsWith(cleanStorage));
              detectedStorage = match || cleanStorage;
            }
          }

          // 6. Detect Title / Model (Filter out condition / marketing slogans)
          const conditionPatterns = /^(new\s*and\s*sealed|brand\s*new|sealed(\s*in\s*box)?|in\s*box|clean\s*used|uk\s*used|foreign\s*used|neat|condition\s*[:\d\/]+|hot\s*deal|best\s*price|promo|available\s*(now)?|fresh|clean\s*machine)$/i;

          let candidateTitle = '';
          for (let i = 0; i < rawLines.length; i++) {
            if (i === priceLineIndex) continue;
            const l = cleanLine(rawLines[i]);
            if (conditionPatterns.test(l)) continue;
            if (l.length >= 3 && !/^\d+$/.test(l)) {
              candidateTitle = l;
              break;
            }
          }
          if (!candidateTitle) {
            for (let i = 0; i < rawLines.length; i++) {
              if (i === priceLineIndex) continue;
              const l = cleanLine(rawLines[i]);
              if (l.length >= 3 && !/^\d+$/.test(l)) {
                candidateTitle = l;
                break;
              }
            }
          }

          // For iPhone models, strip storage duplicate and auto-format (e.g. "18 pro max 256gb" -> "iPhone 18 Pro Max")
          if (detectedCategory === 'phones' && (detectedBrand.includes('Apple') || isPhone)) {
            candidateTitle = candidateTitle.replace(/\b(64|128|256|512)\s*(?:gb|g)\b/i, '').trim();
            if (/^\d{1,2}\s*(?:pro|plus|mini|promax)/i.test(candidateTitle)) {
              candidateTitle = 'iPhone ' + candidateTitle;
            }
          }

          const formatTitleWord = (w: string) => {
            const wl = w.toLowerCase();
            if (wl === 'iphone') return 'iPhone';
            if (wl === 'ipad') return 'iPad';
            if (/^(i[3579]|ssd|hdd|ram|fhd|uhd|oled|ips|4k|2k|x360|m[1234]|ddr[345]|gb|tb)$/i.test(wl)) return w.toUpperCase();
            if (/^\d+[a-z]?$/i.test(wl)) return w.toUpperCase();
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          };

          let finalTitle = candidateTitle
            .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
            .split(/\s+/)
            .filter(Boolean)
            .map(formatTitleWord)
            .join(' ');

          if (!finalTitle) {
            finalTitle = `${detectedBrand} Product`;
          }

          // 7. Compile Highlights
          const highlightsList: string[] = [];
          for (let i = 0; i < rawLines.length; i++) {
            if (i === priceLineIndex) continue;
            const cl = cleanLine(rawLines[i]);
            if (cl === cleanLine(candidateTitle)) continue;
            if (detectedPrice && cl === detectedPrice) continue;
            if (cl.length > 1) {
              highlightsList.push(cl);
            }
          }
          const finalHighlights = highlightsList.join(' · ');

          // Apply values to Form State
          setInventoryCategory(detectedCategory);

          const currentBrandList = detectedCategory === 'laptops'
            ? laptopBrandOptions
            : detectedCategory === 'phones'
              ? phoneBrandOptions
              : gadgetBrandOptions;

          if (currentBrandList.includes(detectedBrand)) {
            setInventoryBrandSelect(detectedBrand);
            setInventoryCustomBrand('');
          } else {
            setInventoryBrandSelect('Other (Custom Brand)');
            setInventoryCustomBrand(detectedCustomBrand || detectedBrand !== 'Other (Custom Brand)' ? detectedBrand : '');
          }

          setInventoryTitle(finalTitle);
          if (detectedPrice) setInventoryPrice(detectedPrice);
          if (detectedCategory === 'laptops' && detectedRam) {
            setInventoryRam(detectedRam);
          } else {
            setInventoryRam('N/A');
          }
          if (detectedStorage) setInventoryStorage(detectedStorage);
          if (finalHighlights) setInventoryHighlights(finalHighlights);

          const details: string[] = [];
          details.push(`Category: ${detectedCategory.toUpperCase()}`);
          details.push(`Brand: ${detectedBrand}`);
          details.push(`Model: ${finalTitle}`);
          if (detectedPrice) details.push(`Price: GHS ${Number(detectedPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
          if (detectedCategory === 'laptops' && detectedRam) details.push(`RAM: ${detectedRam}`);
          if (detectedStorage) details.push(`Storage: ${detectedStorage}`);

          setSmartParseDetails(details);
          setSmartParseSuccess(`Auto-filled ${details.length} fields! Please review the form, attach a product photo, and upload.`);
        } catch (err: unknown) {
          console.error('Smart parsing failed:', err);
          setSmartParseError('Could not parse text. Please check the format and try again.');
        }
      };

      // Filter products by category, gadgetType, search, and brand
      // Filter products by category, gadgetType, search, brand, and vendor
      const displayItems = inventoryItems.filter(item => {
        if (!isAdmin && !item.active) return false;
        if (!isAdmin && !isVendor && !item.active) return false;
        const category = item.category || parseCategory(item);
        const matchesCategory = selectedCategory === 'all' || category === selectedCategory;

        const matchesGadgetType = selectedCategory !== 'gadgets' || selectedGadgetType === 'all' || (
          (item.gadgetType && item.gadgetType.toLowerCase().includes(selectedGadgetType.toLowerCase())) ||
          item.highlights.toLowerCase().includes(selectedGadgetType.toLowerCase())
        );

        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.vendorName && item.vendorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          cleanHighlights(item.highlights).toLowerCase().includes(searchQuery.toLowerCase());

        const matchesBrand = selectedBrand === 'All' || normalizeBrand(item.brand).toLowerCase() === selectedBrand.toLowerCase();

        const matchesVendor = selectedVendorFilter === 'all' || (
          selectedVendorFilter === 'official'
            ? Boolean(item.isOfficial)
            : Boolean(item.vendorName && item.vendorName.toLowerCase() === selectedVendorFilter.toLowerCase())
        );

        return matchesCategory && matchesGadgetType && matchesSearch && matchesBrand && matchesVendor;
      });

      const uniqueBrands = ['All', ...Array.from(new Set(
        inventoryItems
          .filter(item => selectedCategory === 'all' || (item.category || parseCategory(item)) === selectedCategory)
          .map(i => normalizeBrand(i.brand))
      ))];

      const availableVendors = Array.from(new Set(
        inventoryItems.map(i => i.vendorName).filter(Boolean)
      )) as string[];

      return (
        <div className={`min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-black relative overflow-x-hidden ${isLightMode ? 'theme-light' : ''}`}>
          {/* Background Cyberpunk Grid */}
          <div className={`absolute inset-0 bg-[linear-gradient(to_right,#1e1b4b15_1px,transparent_1px),linear-gradient(to_bottom,#1e1b4b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none ${isLightMode ? 'hidden' : ''}`} />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

          {/* Top Header Navigation */}
          <header className="relative z-50 border-b border-cyan-500/30 bg-slate-950/80 backdrop-blur-md sticky top-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-2">
              {/* Logo Brand */}
              <div className="flex min-w-0 items-center space-x-2 sm:space-x-3 cursor-pointer" onClick={() => setActiveTab('catalog')}>
                <img
                  src="/gkb-company-logo.png"
                  alt="GKB Technologies company logo"
                  className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                />
                <div>
                  <h1 className="truncate text-sm sm:text-lg font-black tracking-wider bg-gradient-to-r from-cyan-400 via-purple-300 to-purple-500 bg-clip-text text-transparent">
                    GKB SHOPPING PORTAL
                  </h1>
                  <p className="hidden sm:block text-[10px] text-cyan-400/70 tracking-widest uppercase">Laptops · Mobile Phones · Electronic Gadgets</p>
                </div>
              </div>

              {/* Navigation Items */}
              <nav aria-label="Main navigation" className="hidden md:flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'catalog' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-cyan-300'}`}
                >
                  Gadget Catalog
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      setLoginError('');
                      setLoginMessage('Please sign in or create an account to view and place orders.');
                      setLoginModalOpen(true);
                      return;
                    }
                    setActiveTab('order');
                  }}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'order' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-cyan-300'}`}
                >
                  Order & Track
                </button>
                {canManageInventory && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin-inventory')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === 'admin-inventory' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'text-slate-400 hover:text-purple-300'}`}
                  >
                    {isVendor ? <Store className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
                    {isAdmin ? 'Manage Inventory' : 'Vendor Portal'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('contact')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'contact' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-cyan-300'}`}
                >
                  Contact Us
                </button>
              </nav>

              {/* Right Action Buttons */}
              <div className="flex shrink-0 items-center space-x-2 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => setIsLightMode(!isLightMode)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-slate-900 px-2.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-cyan-400 hover:text-cyan-300 sm:px-3"
                >
                  {isLightMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  <span className="hidden sm:inline">{isLightMode ? 'Dark' : 'Light'}</span>
                </button>

                {user ? (
                  <div className="flex items-center space-x-2 sm:space-x-3 bg-slate-900 border border-purple-500/30 px-2 sm:px-3 py-1.5 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold font-mono tracking-wider text-amber-300">
                        <Shield className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                        Admin
                      </span>
                    ) : isVendor ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold font-mono tracking-wider text-purple-300">
                        <Store className="w-3.5 h-3.5 text-purple-400" />
                        {user?.businessName || user?.firstName || 'Vendor'}
                      </span>
                    ) : (
                      <span className="text-xs text-purple-300 font-mono truncate max-w-[72px] sm:max-w-[120px]">{user.firstName || user.email}</span>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="text-slate-400 hover:text-red-400 transition-colors"
                      title="Logout"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen(true)}
                    className="px-3 sm:px-4 py-2 rounded-lg font-bold text-xs tracking-wider uppercase bg-gradient-to-r from-cyan-500 to-purple-600 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] transition-all"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex md:hidden gap-1 overflow-x-auto border-t border-slate-800/70 px-3 py-2 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${activeTab === 'catalog' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40' : 'text-slate-400'}`}
              >
                Catalog
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('order')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${activeTab === 'order' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40' : 'text-slate-400'}`}
              >
                Order & Track
              </button>
              {canManageInventory && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin-inventory')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap flex items-center gap-1 ${activeTab === 'admin-inventory' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400'}`}
                >
                  {isVendor ? <Store className="h-3 w-3" /> : null}
                  {isAdmin ? 'Inventory' : 'Vendor Hub'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('contact')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${activeTab === 'contact' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40' : 'text-slate-400'}`}
              >
                Contact
              </button>
            </nav>
          </header>

          {/* Main Container */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* ================= STOREFRONT CATALOG ================= */}
            {activeTab === 'catalog' && (
      <div className="space-y-8 animate-fadeIn">
        {/* ================= JUMIA-STYLE DAILY ADVERTISING BANNER CAROUSEL ================= */}
        <section
          aria-label="Daily Featured Tech Advertisements"
          className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-slate-950 shadow-2xl group select-none"
          onMouseEnter={() => setIsAdPaused(true)}
          onMouseLeave={() => setIsAdPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Subtle Top Control Strip: Deal Counter & Daily Status */}
          <div className="absolute top-3.5 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-slate-950/80 px-3 py-1 text-[11px] font-bold font-mono tracking-wider text-amber-300 shadow-sm backdrop-blur-md">
                <Flame className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                DAILY FEATURED DEALS
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-slate-950/70 px-2.5 py-1 text-[10px] font-mono text-cyan-300 backdrop-blur-md">
                <Sparkles className="h-3 w-3 text-cyan-400" />
                Auto-Shuffle · Laptops, Phones & Gadgets
              </span>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <span className="rounded-full border border-slate-700/80 bg-slate-950/80 px-2.5 py-1 text-[10px] font-mono font-bold text-slate-300 backdrop-blur-md">
                Deal {((adSlideIndex % Math.max(1, advertisedProducts.length)) + 1)} of {advertisedProducts.length}
              </span>
              <button
                type="button"
                onClick={() => setIsAdPaused(p => !p)}
                className="p-1.5 rounded-full border border-slate-700/80 bg-slate-950/80 hover:bg-slate-900 text-slate-300 transition-colors backdrop-blur-md cursor-pointer"
                title={isAdPaused ? 'Resume auto-slides' : 'Pause auto-slides'}
              >
                {isAdPaused ? <Play className="h-3 w-3 text-emerald-400" /> : <Pause className="h-3 w-3 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Sliding Track: swipe left effect */}
          <div
            className="flex w-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${(adSlideIndex % Math.max(1, advertisedProducts.length)) * 100}%)` }}
          >
            {advertisedProducts.map((item, index) => {
              const category = item.category || parseCategory(item);
              const isLaptop = category === 'laptops';
              const isPhone = category === 'phones';
              const isGadget = category === 'gadgets';

              const imageUrl = item.image_path && relaySupabase
                ? relaySupabase.storage.from(inventoryImageBucket).getPublicUrl(item.image_path).data.publicUrl
                : null;

              const cleanDesc = cleanHighlights(item.highlights);

              // Category-based background theme
              const bgGradient = isPhone
                ? 'from-slate-950 via-purple-950/50 to-slate-950'
                : isGadget
                  ? 'from-slate-950 via-emerald-950/40 to-slate-950'
                  : 'from-slate-950 via-cyan-950/40 to-slate-900';

              const glowColor = isPhone ? 'bg-purple-600/15' : isGadget ? 'bg-emerald-600/15' : 'bg-cyan-600/15';

              return (
                <div
                  key={`${item.id}-${index}`}
                  className={`w-full flex-shrink-0 min-w-full relative overflow-hidden bg-gradient-to-r ${bgGradient} px-6 sm:px-12 pt-14 pb-14 sm:pb-16`}
                >
                  {/* Category Ambient Glow Orbs */}
                  <div className={`absolute top-0 right-1/4 w-96 h-96 ${glowColor} rounded-full blur-[100px] pointer-events-none`} />
                  <div className="absolute bottom-0 left-10 w-72 h-72 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none" />

                  <div className="relative z-10 grid gap-8 lg:grid-cols-12 lg:items-center">
                    {/* Left Column: Product Info & Actions (7 cols) */}
                    <div className="space-y-4 lg:col-span-7">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Category Tag */}
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold font-mono tracking-wider uppercase border shadow-sm ${
                          isPhone
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : isGadget
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        }`}>
                          {isPhone ? <Smartphone className="h-3.5 w-3.5" /> : isGadget ? <HardDrive className="h-3.5 w-3.5" /> : <Laptop className="h-3.5 w-3.5" />}
                          {isPhone ? 'Smartphone Deal' : isGadget ? 'Electronic Gadget' : 'High-Performance Laptop'}
                        </span>

                        {/* Brand Pill */}
                        <span className="rounded-full border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-xs font-bold text-slate-200">
                          {normalizeBrand(item.brand)}
                        </span>

                        {/* Vendor attribution badge */}
                        {item.isOfficial ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-300">
                            <BadgeCheck className="h-3 w-3 text-cyan-400" /> GKB Official
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                            <Store className="h-3 w-3 text-amber-400" /> {item.vendorName || 'Verified Vendor'}
                          </span>
                        )}
                      </div>

                      {/* Product Title */}
                      <div>
                        <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight line-clamp-2">
                          {item.title}
                        </h2>
                      </div>

                      {/* Specs Row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                        {isLaptop && item.ram && item.ram !== 'N/A' && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-cyan-300 font-mono">
                            <Cpu className="h-3.5 w-3.5 text-cyan-400" /> {item.ram} RAM
                          </span>
                        )}
                        {item.storage && item.storage !== 'None' && item.storage !== 'N/A' && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-purple-300 font-mono">
                            <HardDrive className="h-3.5 w-3.5 text-purple-400" /> {item.storage}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-emerald-300 font-mono">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Tested Hardware
                        </span>
                      </div>

                      {/* Highlights Snippet */}
                      {cleanDesc && (
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-2 max-w-xl">
                          {cleanDesc}
                        </p>
                      )}

                      {/* Price & Guarantee Box */}
                      <div className="pt-1 flex flex-wrap items-baseline gap-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Daily Promo Price:
                        </div>
                        <div className="text-2xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight drop-shadow-[0_0_15px_rgba(252,211,77,0.3)]">
                          GHS {item.price.toFixed(2)}
                        </div>
                      </div>

                      {/* Action CTA Buttons */}
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => handleOrderProduct(item)}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-400 to-purple-600 px-6 py-3 text-sm font-black text-black shadow-lg shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        >
                          <ShoppingBag className="h-4 w-4" /> Order This Deal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory(category);
                            setSelectedBrand('All');
                            const el = document.getElementById('catalog-grid');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-xs sm:text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        >
                          <Layers className="h-4 w-4" /> Browse In Catalog
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Visual Product Showcase (5 cols) */}
                    <div className="lg:col-span-5 flex items-center justify-center relative">
                      <div className="relative w-full max-w-sm aspect-[4/3] rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 flex items-center justify-center overflow-hidden shadow-2xl backdrop-blur-sm group-hover:border-cyan-500/40 transition-colors">
                        {/* Radial Spotlight Behind Image */}
                        <div className="absolute inset-0 bg-radial from-cyan-500/10 via-transparent to-transparent opacity-60 pointer-events-none" />

                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.title}
                            className="max-h-56 sm:max-h-64 w-auto object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)] transform group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-600 space-y-2 py-8">
                            {isPhone ? (
                              <Smartphone className="h-20 w-20 text-purple-400/60 stroke-[1.2]" />
                            ) : isGadget ? (
                              <HardDrive className="h-20 w-20 text-emerald-400/60 stroke-[1.2]" />
                            ) : (
                              <Laptop className="h-20 w-20 text-cyan-400/60 stroke-[1.2]" />
                            )}
                            <span className="text-xs font-mono text-slate-400">GKB Verified Stock</span>
                          </div>
                        )}

                        {/* Floating Guarantee Badge */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono font-semibold px-2.5 py-1.5 rounded-lg bg-slate-950/85 border border-slate-800 backdrop-blur-md text-slate-300">
                          <span className="flex items-center gap-1 text-cyan-300">
                            <Shield className="h-3 w-3 text-cyan-400" /> Ghana Warranty
                          </span>
                          <span className="text-slate-400">Nationwide Delivery</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={prevAdSlide}
            aria-label="Previous Deal"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full border border-slate-700/80 bg-slate-950/70 hover:bg-slate-900 text-slate-200 hover:text-white flex items-center justify-center backdrop-blur-md shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Right Arrow Button (Swipe Left trigger) */}
          <button
            type="button"
            onClick={nextAdSlide}
            aria-label="Next Deal"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full border border-slate-700/80 bg-slate-950/70 hover:bg-slate-900 text-slate-200 hover:text-white flex items-center justify-center backdrop-blur-md shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Bottom Pagination Dots / Bars (Jumia Style) */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800/80 backdrop-blur-md">
            {advertisedProducts.map((_, dotIdx) => {
              const isActive = (adSlideIndex % Math.max(1, advertisedProducts.length)) === dotIdx;
              return (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => setAdSlideIndex(dotIdx)}
                  aria-label={`Go to slide ${dotIdx + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'w-7 bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]'
                      : 'w-2 bg-slate-700/80 hover:bg-slate-500'
                  }`}
                />
              );
            })}
          </div>
        </section>

        {/* Category Selector Tabs */}
        <div id="catalog-grid" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setSelectedCategory('all'); setSelectedBrand('All'); }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${selectedCategory === 'all'
                  ? 'gkb-store-tab-active bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25 border border-cyan-400'
                  : 'gkb-store-tab-inactive bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300'
                }`}
            >
              <Layers className="h-4 w-4" />
              <span>All Items</span>
              <span className="ml-1 text-[11px] font-mono opacity-80">
                ({inventoryItems.filter(i => isAdmin || i.active).length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedCategory('laptops'); setSelectedBrand('All'); }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${selectedCategory === 'laptops'
                  ? 'gkb-store-tab-active bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25 border border-cyan-400'
                  : 'gkb-store-tab-inactive bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300'
                }`}
            >
              <Laptop className="h-4 w-4" />
              <span>Laptops & Computers</span>
              <span className="ml-1 text-[11px] font-mono opacity-80">
                ({inventoryItems.filter(i => (isAdmin || i.active) && (i.category || parseCategory(i)) === 'laptops').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedCategory('phones'); setSelectedBrand('All'); }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${selectedCategory === 'phones'
                  ? 'gkb-store-tab-active bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25 border border-cyan-400'
                  : 'gkb-store-tab-inactive bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300'
                }`}
            >
              <Smartphone className="h-4 w-4" />
              <span>Mobile Phones</span>
              <span className="ml-1 text-[11px] font-mono opacity-80">
                ({inventoryItems.filter(i => (isAdmin || i.active) && (i.category || parseCategory(i)) === 'phones').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedCategory('gadgets'); setSelectedBrand('All'); }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${selectedCategory === 'gadgets'
                  ? 'gkb-store-tab-active bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25 border border-cyan-400'
                  : 'gkb-store-tab-inactive bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300'
                }`}
            >
              <HardDrive className="h-4 w-4" />
              <span>Electronic Gadgets</span>
              <span className="ml-1 text-[11px] font-mono opacity-80">
                ({inventoryItems.filter(i => (isAdmin || i.active) && (i.category || parseCategory(i)) === 'gadgets').length})
              </span>
            </button>
          </div>

          {/* Sub-Filters for Electronic Gadgets */}
          {selectedCategory === 'gadgets' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none animate-fadeIn">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 shrink-0">Sub-Filter:</span>
              {[
                { key: 'all', label: 'All Gadgets' },
                { key: 'hard drive', label: 'Storage & Hard Drives' },
                { key: 'stand', label: 'Laptop Stands' },
                { key: 'mouse', label: 'Mice & Keyboards' },
                { key: 'charger', label: 'Power & Chargers' },
                { key: 'audio', label: 'Audio & Wearables' },
                { key: 'iot', label: 'Smart IoT Kits' }
              ].map(sub => (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => setSelectedGadgetType(sub.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${selectedGadgetType === sub.key
                      ? 'gkb-subfilter-active bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                      : 'gkb-subfilter-inactive bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {/* Search and Brand Pills */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={
                  selectedCategory === 'phones'
                    ? 'Search iPhones, Samsung, Tecno, storage…'
                    : selectedCategory === 'gadgets'
                      ? 'Search hard drives, laptop stands, mice, chargers…'
                      : 'Search laptops, specs, brand, or model…'
                }
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Brand Pills tailored to current category */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {/* Brand & Vendor Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-wrap sm:flex-nowrap">
                <Filter className="h-4 w-4 text-cyan-400 shrink-0 hidden sm:block" />

                {/* Vendor Dropdown Filter */}
                {availableVendors.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-purple-500/30 rounded-lg px-2.5 py-1 text-xs shrink-0">
                    <Store className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                    <select
                      value={selectedVendorFilter}
                      onChange={e => setSelectedVendorFilter(e.target.value)}
                      className="bg-transparent text-purple-200 font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="all" className="bg-slate-950 text-white">All Sellers ({inventoryItems.length})</option>
                      <option value="official" className="bg-slate-950 text-white">⚡ GKB Official</option>
                      {availableVendors.filter(v => !v.toLowerCase().includes('official')).map(v => (
                        <option key={v} value={v} className="bg-slate-950 text-white">🏪 {v}</option>
                      ))}
                    </select>
                  </div>
                )}

                {uniqueBrands.map(brand => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => setSelectedBrand(brand)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${selectedBrand === brand
                        ? 'gkb-subfilter-active bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'gkb-subfilter-inactive border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                      }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Cards Grid */}
          {inventoryLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin text-cyan-400 mx-auto" />
              <p className="text-sm text-slate-400">Loading retail inventory…</p>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="py-20 text-center space-y-3 border border-slate-800/80 rounded-2xl bg-slate-900/30">
              <Tag className="h-10 w-10 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-white">No products found</h3>
              <p className="text-xs text-slate-400">Try adjusting your category, search query, or brand filter.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {displayItems.map(item => {
                const imageUrl = item.image_path && relaySupabase
                  ? relaySupabase.storage.from(inventoryImageBucket).getPublicUrl(item.image_path).data.publicUrl
                  : null;

                const category = item.category || parseCategory(item);
                const isLaptop = category === 'laptops';
                const isPhone = category === 'phones';
                const isGadget = category === 'gadgets';

                return (
                  <article
                    key={item.id}
                    className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)]"
                  >
                    <div>
                      {/* Image Preview Container */}
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950 flex items-center justify-center border-b border-slate-800/60">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-6 text-slate-600">
                            {isLaptop ? (
                              <Laptop className="h-14 w-14 text-cyan-500/40" />
                            ) : isPhone ? (
                              <Smartphone className="h-14 w-14 text-purple-500/40" />
                            ) : (
                              <HardDrive className="h-14 w-14 text-emerald-500/40" />
                            )}
                            <span className="mt-2 text-xs font-mono uppercase tracking-wider text-slate-500">
                              {normalizeBrand(item.brand)} · {isPhone ? 'Mobile Handset' : isGadget ? 'Electronic Gadget' : 'Laptop Workstation'}
                            </span>
                          </div>
                        )}

                        {/* Category & Brand Badges */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <span className="rounded-full bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                            {normalizeBrand(item.brand)}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wide border ${isPhone
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : isGadget
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            }`}>
                            {isPhone ? 'Phone' : isGadget ? 'Gadget' : 'Laptop'}
                          </span>
                        </div>

                        {/* Vendor / Official Badge on Top-Right */}
                        <div className="absolute top-3 right-3 flex items-center">
                          {item.isOfficial ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 px-2.5 py-1 text-[10px] font-bold text-cyan-300 shadow-sm">
                              <BadgeCheck className="h-3 w-3 text-cyan-400" />
                              <span>GKB Official</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-amber-500/40 px-2.5 py-1 text-[10px] font-bold text-amber-300 shadow-sm">
                              <Store className="h-3 w-3 text-amber-400" />
                              <span className="max-w-[110px] truncate">{item.vendorName || 'Partner Vendor'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="p-5 space-y-3">
                        <div>
                          <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {item.title}
                          </h3>
                          {/* Seller / Vendor Attribution Tag */}
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                            <span className="text-slate-500">Sold by:</span>
                            {item.isOfficial ? (
                              <span className="font-semibold text-cyan-400 flex items-center gap-1">
                                <Zap className="h-3 w-3" /> GKB Official Store
                              </span>
                            ) : (
                              <span className="font-semibold text-amber-300 flex items-center gap-1">
                                <Store className="h-3 w-3" /> {item.vendorName || 'Authorized Vendor'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Spec Badges adapted to category */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          {isLaptop && (
                            <>
                              <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-purple-300">
                                {item.ram} RAM
                              </span>
                              <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-300">
                                {item.storage}
                              </span>
                              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                                Verified Stock
                              </span>
                            </>
                          )}

                          {isPhone && (
                            <>
                              <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-cyan-300 font-bold">
                                {item.storage} Storage
                              </span>
                              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                                Genuine Handset
                              </span>
                            </>
                          )}

                          {isGadget && (
                            <>
                              {item.storage && item.storage !== 'None' && item.storage !== 'None / N/A' && item.storage !== 'N/A' && (
                                <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-300">
                                  {item.storage}
                                </span>
                              )}
                              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                                {item.gadgetType || 'Electronic Gadget'}
                              </span>
                              <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-slate-300">
                                Genuine Hardware
                              </span>
                            </>
                          )}
                        </div>

                        {/* Highlights */}
                        <InventoryHighlights text={item.highlights} />
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="border-t border-slate-800/80 p-5 pt-4 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Cash / MoMo Price</p>
                        {isItemOwner(item) && editingPriceItemId === item.id ? (
                          <div className="mt-1 flex items-center gap-1.5 animate-fadeIn">
                            <span className="text-xs font-mono font-bold text-amber-300">GHS</span>
                            <input
                              type="number"
                              step="0.01"
                              min="1"
                              value={editPriceValue}
                              onChange={e => setEditPriceValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleSavePrice(item);
                                } else if (e.key === 'Escape') {
                                  handleCancelEditPrice();
                                }
                              }}
                              className="w-24 rounded border border-cyan-400 bg-slate-900 px-2 py-1 text-xs font-bold text-white focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              disabled={priceSavingId === item.id}
                              onClick={() => void handleSavePrice(item)}
                              className="p-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Save new price"
                            >
                              {priceSavingId === item.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            </button>
                            <button
                              type="button"
                              disabled={priceSavingId === item.id}
                              onClick={handleCancelEditPrice}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-xl font-black text-yellow-300">
                              GHS {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            {isItemOwner(item) && (
                              <button
                                type="button"
                                onClick={() => handleStartEditPrice(item)}
                                className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
                                title="Edit price (Owner/Admin)"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOrderProduct(item)}
                        className="gkb-order-btn inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-md shadow-cyan-500/20 hover:scale-105 transition-all cursor-pointer"
                      >
                        Order Now
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
              </div>
            )}
          </div>
        </div>
      )}

        {/* ================= ORDER & TRACK VIEW ================= */}
        {activeTab === 'order' && (
          <div className="space-y-6 animate-fadeIn">
            <OrdersPortal
              user={user}
              initialProductName={selectedOrderProduct}
              initialPrice={selectedOrderPrice}
              onBack={() => setActiveTab('catalog')}
              onOpenLogin={() => setLoginModalOpen(true)}
              onOrderSubmitted={() => {
                setSelectedOrderProduct('');
                setSelectedOrderPrice(null);
              }}
            />
          </div>
        )}

        {/* ================= ADMIN & VENDOR INVENTORY VIEW ================= */}
        {activeTab === 'admin-inventory' && canManageInventory && (
          <div className="space-y-8 animate-fadeIn">
            <section className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-white">
                      {isAdmin ? 'GKB Admin Inventory & Vendor Management' : 'Vendor Merchant Portal'}
                    </h3>
                    {isVendor && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <Store className="h-3.5 w-3.5 text-amber-400" />
                        <span>{user?.businessName || 'Authorized Vendor'}</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {isAdmin
                      ? 'Upload and manage retail listings for GKB Official Store or partner vendors.'
                      : `Upload and manage your store products on GKB Shopping Portal as ${user?.businessName || 'Vendor'}.`}
                  </p>
                </div>

                {/* Database Schema helper trigger (Admin only) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowSqlHelper(v => !v)}
                    className="gkb-sql-helper-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 text-xs font-mono font-medium transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    {showSqlHelper ? 'Hide SQL Migration' : 'Supabase SQL Helper'}
                  </button>
                )}
              </div>

              {/* Optional SQL Migration Card for Admin */}
              {isAdmin && showSqlHelper && (
                <div className="mt-4 p-4 rounded-xl border border-slate-700 bg-slate-950/90 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono text-cyan-400 font-bold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Optional: Supabase Schema Upgrade SQL
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const sql = `-- GKB Shopping Portal Schema Migration\nALTER TABLE public.gkb_inventory_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'laptops';\nALTER TABLE public.gkb_inventory_items ADD COLUMN IF NOT EXISTS vendor_id TEXT;\nALTER TABLE public.gkb_inventory_items ADD COLUMN IF NOT EXISTS vendor_name TEXT DEFAULT 'GKB Official Store';\nALTER TABLE public.gkb_inventory_items ADD COLUMN IF NOT EXISTS vendor_phone TEXT DEFAULT '0552117787';\nALTER TABLE public.gkb_inventory_items DROP CONSTRAINT IF EXISTS gkb_inventory_items_ram_check;\nALTER TABLE public.gkb_inventory_items DROP CONSTRAINT IF EXISTS gkb_inventory_items_storage_check;\nALTER TABLE public.gkb_inventory_items ALTER COLUMN ram DROP NOT NULL;\nALTER TABLE public.gkb_inventory_items ALTER COLUMN storage DROP NOT NULL;\nGRANT DELETE ON TABLE public.gkb_inventory_items TO authenticated;\nDROP POLICY IF EXISTS gkb_inventory_delete_admin ON public.gkb_inventory_items;\nCREATE POLICY gkb_inventory_delete_admin ON public.gkb_inventory_items FOR DELETE TO authenticated USING (public.is_gkb_admin());`;
                        navigator.clipboard.writeText(sql);
                        setSqlCopied(true);
                        setTimeout(() => setSqlCopied(false), 2500);
                      }}
                      className="px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono hover:bg-cyan-500/20 flex items-center gap-1 transition-all"
                    >
                      {sqlCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {sqlCopied ? 'Copied SQL!' : 'Copy SQL Script'}
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto border border-slate-800">
{`-- Run once in Supabase SQL Editor if you want native category, vendor, & delete permissions:
ALTER TABLE public.gkb_inventory_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'laptops';
ALTER TABLE public.gkb_inventory_items ADD COLUMN IF NOT EXISTS vendor_id TEXT;
ALTER TABLE public.gkb_inventory_items ADD COLUMN IF NOT EXISTS vendor_name TEXT DEFAULT 'GKB Official Store';
ALTER TABLE public.gkb_inventory_items ADD COLUMN IF NOT EXISTS vendor_phone TEXT DEFAULT '0552117787';
ALTER TABLE public.gkb_inventory_items DROP CONSTRAINT IF EXISTS gkb_inventory_items_ram_check;
ALTER TABLE public.gkb_inventory_items DROP CONSTRAINT IF EXISTS gkb_inventory_items_storage_check;
GRANT DELETE ON TABLE public.gkb_inventory_items TO authenticated;
DROP POLICY IF EXISTS gkb_inventory_delete_admin ON public.gkb_inventory_items;
CREATE POLICY gkb_inventory_delete_admin ON public.gkb_inventory_items FOR DELETE TO authenticated USING (public.is_gkb_admin());`}
                  </pre>
                  <p className="text-[11px] text-slate-400">
                    *Note: Our portal automatically preserves all categories, vendors, and specs in highlights metadata even if you haven't run the SQL yet!
                  </p>
                </div>
              )}

              {/* ================= SMART WHATSAPP SPEC ANALYZER ================= */}
              <div className="mt-6 rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-slate-900/95 via-cyan-950/20 to-slate-900/95 p-5 sm:p-6 shadow-xl shadow-cyan-950/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
                      <Sparkles className="h-5 w-5 animate-pulse text-cyan-300" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        Smart Text & WhatsApp Spec Auto-Fill
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold uppercase tracking-wider">
                          Instant Parser
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Paste supplier broadcasts, WhatsApp dealer lists, or raw specs. The system extracts brand, model, RAM, storage, price, and highlights automatically!
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSmartParser(v => !v)}
                    className="text-xs font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    {showSmartParser ? 'Collapse Analyzer ▲' : 'Expand Analyzer ▼'}
                  </button>
                </div>

                {showSmartParser && (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div className="relative">
                      <textarea
                        rows={5}
                        value={smartParseText}
                        onChange={e => setSmartParseText(e.target.value)}
                        placeholder={"Paste WhatsApp broadcast text or product specs here, e.g.:\n*DELL PRECISION 13 7359*\n*Intel core i7* 🔥\n*6Th Generation*\n*256GB SSD*\n*16GB DDR4 Ram*\n*Touchscreen*✅\n*X360 convertible*\n*Keyboard Light* 💡\n13.3FHD\n*Stylus Pen 🖊️*\nDolby audio ✅\nWebcam\nBluetooth\nWiFi\n\n4490"}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-xs sm:text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 focus:outline-none transition-all leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleSmartParseSpecs}
                        disabled={!smartParseText.trim()}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50 transition-all"
                      >
                        <Sparkles className="h-4 w-4" />
                        ⚡ Analyze & Auto-Fill Form
                      </button>

                      {smartParseText && (
                        <button
                          type="button"
                          onClick={() => {
                            setSmartParseText('');
                            setSmartParseSuccess(null);
                            setSmartParseError(null);
                            setSmartParseDetails([]);
                          }}
                          className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition-all"
                        >
                          Clear
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSmartParseText(`*DELL PRECISION 13 7359*
*Intel core i7* 🔥
*6Th Generation*
*256GB SSD*
*16GB DDR4 Ram*
*Touchscreen*✅
*X360 convertible*
*Keyboard Light* 💡 
13.3FHD 
*Stylus Pen 🖊️* 
Dolby audio ✅
Webcam 
Bluetooth 
WiFi

4490`);
                          setSmartParseError(null);
                        }}
                        className="text-[11px] font-mono text-cyan-400/80 hover:text-cyan-300 underline ml-auto cursor-pointer"
                      >
                        Load Dell Precision Example
                      </button>
                    </div>

                    {smartParseError && (
                      <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                        <span>{smartParseError}</span>
                      </div>
                    )}

                    {smartParseSuccess && (
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono space-y-2 animate-fadeIn">
                        <p className="font-bold flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>{smartParseSuccess}</span>
                        </p>
                        {smartParseDetails.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {smartParseDetails.map((detail, idx) => (
                              <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-[11px] text-slate-200 font-semibold shadow-xs">
                                {detail}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <form onSubmit={handleAddInventoryItem} className="mt-6 grid gap-4 sm:grid-cols-2">
                {/* Admin: Select Vendor / Store Owner */}
                {isAdmin && (
                  <div className="sm:col-span-2 p-3.5 rounded-xl border border-cyan-500/30 bg-slate-950/60 space-y-2">
                    <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                      Product Seller / Vendor Assignment
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <select
                          value={vendorAssignment}
                          onChange={e => setVendorAssignment(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
                        >
                          <option value="GKB Official Store">⚡ GKB Official Store (Direct Stock)</option>
                          {availableVendors
                            .filter(v => v !== 'GKB Official Store')
                            .map(v => (
                              <option key={v} value={v}>
                                🏪 {v}
                              </option>
                            ))}
                          <option value="New Custom Vendor">+ Assign to New Custom Vendor</option>
                        </select>
                      </div>

                      {vendorAssignment === 'New Custom Vendor' && (
                        <div className="grid grid-cols-2 gap-2 animate-fadeIn">
                          <input
                            type="text"
                            required
                            value={vendorCustomAssignName}
                            onChange={e => setVendorCustomAssignName(e.target.value)}
                            placeholder="Vendor Store Name *"
                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                          />
                          <input
                            type="tel"
                            value={vendorCustomAssignPhone}
                            onChange={e => setVendorCustomAssignPhone(e.target.value)}
                            placeholder="Vendor Phone (optional)"
                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vendor: Identity Banner */}
                {isVendor && (
                  <div className="sm:col-span-2 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                        <Store className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-200">
                          Listing as: <span className="text-white underline font-mono">{user?.businessName || 'Verified Vendor'}</span>
                        </p>
                        <p className="text-[11px] text-amber-300/70">
                          This product will be published to the GKB Shopping Catalog under your store name with direct order routing.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-400/30 text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider shrink-0">
                      Merchant Mode
                    </span>
                  </div>
                )}

                {/* 1. Main Category Dropdown */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-cyan-400 dark:text-cyan-300 uppercase tracking-wider block mb-2">
                    Select Product Category
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleAdminCategoryChange('laptops')}
                      className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${inventoryCategory === 'laptops'
                          ? 'gkb-cat-tab-active bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-400/40'
                          : 'gkb-cat-tab-inactive bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                        }`}
                    >
                      <Laptop className="h-4 w-4" />
                      Laptops & Computers
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAdminCategoryChange('phones')}
                      className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${inventoryCategory === 'phones'
                          ? 'gkb-cat-tab-active bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-400/40'
                          : 'gkb-cat-tab-inactive bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                        }`}
                    >
                      <Smartphone className="h-4 w-4" />
                      Mobile Phones
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAdminCategoryChange('gadgets')}
                      className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${inventoryCategory === 'gadgets'
                          ? 'gkb-cat-tab-active bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-400/40'
                          : 'gkb-cat-tab-inactive bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                        }`}
                    >
                      <HardDrive className="h-4 w-4" />
                      Electronic Gadgets
                    </button>
                  </div>
                </div>

                {/* 2. Brand Dropdown with custom option */}
                <label className="text-xs font-semibold text-slate-300">
                  Brand / Manufacturer
                  <select
                    value={inventoryBrandSelect}
                    onChange={e => setInventoryBrandSelect(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                  >
                    {(inventoryCategory === 'laptops'
                      ? laptopBrandOptions
                      : inventoryCategory === 'phones'
                        ? phoneBrandOptions
                        : gadgetBrandOptions
                    ).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>

                {/* Custom Brand input if 'Other' is selected */}
                {inventoryBrandSelect === 'Other (Custom Brand)' ? (
                  <label className="text-xs font-semibold text-slate-300">
                    Custom Brand Name
                    <input
                      type="text"
                      value={inventoryCustomBrand}
                      onChange={e => setInventoryCustomBrand(e.target.value)}
                      maxLength={100}
                      required
                      placeholder="e.g., Nothing, Razer, Sony, Baseus..."
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                    />
                  </label>
                ) : (
                  <div className="hidden sm:block" />
                )}

                {/* 3. Electronic Gadget Subcategory if Gadgets selected */}
                {inventoryCategory === 'gadgets' && (
                  <label className="text-xs font-semibold text-slate-300 sm:col-span-2">
                    Gadget Type / Subcategory
                    <select
                      value={inventoryGadgetType}
                      onChange={e => setInventoryGadgetType(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                    >
                      {gadgetTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </label>
                )}

                {/* 4. Product Title & Model */}
                <label className="text-xs font-semibold text-slate-300 sm:col-span-2">
                  Product Title & Model Name
                  <input
                    type="text"
                    value={inventoryTitle}
                    onChange={e => setInventoryTitle(e.target.value)}
                    maxLength={160}
                    required
                    placeholder={
                      inventoryCategory === 'laptops'
                        ? "e.g., HP EliteBook 840 G7 · 14.0' FHD Core i7"
                        : inventoryCategory === 'phones'
                          ? "e.g., iPhone 13 Pro Max · 128GB Sierra Blue or Samsung S22 Ultra"
                          : "e.g., Seagate 2TB USB 3.0 External Hard Drive or Aluminum Foldable Stand"
                    }
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                  />
                </label>

                {/* 5. Price in GHS */}
                <label className="text-xs font-semibold text-slate-300">
                  Retail Price in GHS
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={inventoryPrice}
                    onChange={e => setInventoryPrice(e.target.value)}
                    required
                    placeholder="3500.00"
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                  />
                </label>

                {/* 6. RAM & Storage (Dynamic per category) */}
                {inventoryCategory === 'laptops' && (
                  <>
                    <label className="text-xs font-semibold text-slate-300">
                      Installed RAM
                      <select
                        value={inventoryRam}
                        onChange={e => setInventoryRam(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                      >
                        {laptopRamOptions.map(opt => <option key={opt}>{opt}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-300">
                      Storage Drive
                      <select
                        value={inventoryStorage}
                        onChange={e => setInventoryStorage(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                      >
                        {laptopStorageOptions.map(opt => <option key={opt}>{opt}</option>)}
                      </select>
                    </label>
                  </>
                )}

                {inventoryCategory === 'phones' && (
                  <label className="text-xs font-semibold text-slate-300 sm:col-span-2">
                    Mobile Internal Storage Capacity
                    <select
                      value={inventoryStorage}
                      onChange={e => setInventoryStorage(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                    >
                      {phoneStorageOptions.map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                  </label>
                )}

                {inventoryCategory === 'gadgets' && (
                  <label className="text-xs font-semibold text-slate-300">
                    Storage Capacity (For Hard Drives, SSDs, Power Banks)
                    <select
                      value={inventoryGadgetCapacity}
                      onChange={e => setInventoryGadgetCapacity(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                    >
                      {gadgetCapacityOptions.map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                  </label>
                )}

                {/* 7. Image Upload */}
                <label className="text-xs font-semibold text-slate-300">
                  Product Image (JPG, PNG, WebP)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => setInventoryImage(e.target.files?.[0] ?? null)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-300"
                  />
                </label>

                {/* 8. Highlights & Specs */}
                <label className="text-xs font-semibold text-slate-300 sm:col-span-2">
                  Key Specs & Highlights
                  <textarea
                    rows={3}
                    value={inventoryHighlights}
                    onChange={e => setInventoryHighlights(e.target.value)}
                    required
                    placeholder={
                      inventoryCategory === 'laptops'
                        ? "Processor, display size, battery life, condition, keyboard light, ports..."
                        : inventoryCategory === 'phones'
                          ? "Battery health, camera specs, dual SIM status, condition (in box, pristine), network (5G)..."
                          : "Connectivity, material, dimensions, compatibility, power rating, included accessories..."
                    }
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                  />
                </label>

                {inventoryError && (
                  <p className="sm:col-span-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                    {inventoryError}
                  </p>
                )}
                {inventoryMessage && (
                  <p className="sm:col-span-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg">
                    {inventoryMessage}
                  </p>
                )}

                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit"
                    disabled={inventoryBusy}
                    className="gkb-primary-btn inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <PlusCircle className="h-4 w-4" />
                    {inventoryBusy ? 'Publishing…' : `Publish ${inventoryCategory === 'phones' ? 'Phone' : inventoryCategory === 'gadgets' ? 'Gadget' : 'Laptop'} to Store`}
                  </button>
                </div>
              </form>
            </section>

            {/* Existing Inventory Management Table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {isVendor ? `Your Merchant Listings (${inventoryItems.filter(isItemOwner).length})` : `All Inventory & Partner Listings (${inventoryItems.length})`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isVendor
                      ? 'Manage your store products, adjust retail prices as wholesale costs change, or toggle active status.'
                      : 'Master inventory control: adjust prices, assign vendors, or toggle active status.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-400 font-mono">
                    {inventoryItems.filter(i => (i.category || parseCategory(i)) === 'laptops').length} Laptops · {inventoryItems.filter(i => (i.category || parseCategory(i)) === 'phones').length} Phones · {inventoryItems.filter(i => (i.category || parseCategory(i)) === 'gadgets').length} Gadgets
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Filter by Seller:</span>
                      <select
                        value={selectedVendorFilter}
                        onChange={e => setSelectedVendorFilter(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
                      >
                        <option value="all">All Sellers ({availableVendors.length})</option>
                        {availableVendors.map(v => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

                {priceEditSuccess && (
                  <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    {priceEditSuccess}
                  </div>
                )}

                {priceEditError && (
                  <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                    {priceEditError}
                  </div>
                )}

                <div className="divide-y divide-slate-800">
                  {inventoryItems
                    .filter(item => {
                      if (isVendor) return isItemOwner(item);
                      if (isAdmin && selectedVendorFilter !== 'all') {
                        return (item.vendorName || 'GKB Official Store') === selectedVendorFilter;
                      }
                      return true;
                    })
                    .map(item => {
                      const category = item.category || parseCategory(item);
                      const isEditingThisPrice = editingPriceItemId === item.id;
                      const canEdit = isItemOwner(item);
                      return (
                                  <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-white">{item.title}</span>
                                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${category === 'phones'
                                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                            : category === 'gadgets'
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                          }`}>
                                          {category === 'phones' ? 'PHONE' : category === 'gadgets' ? 'GADGET' : 'LAPTOP'}
                                        </span>
                                        {/* Vendor badge in row */}
                                        {item.isOfficial ? (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                                            <BadgeCheck className="h-3 w-3 text-cyan-400" /> GKB Official
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                            <Store className="h-3 w-3 text-amber-400" /> {item.vendorName || 'Vendor'}
                                          </span>
                                        )}
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                          {item.active ? 'ACTIVE' : 'ARCHIVED'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-400 mt-1">
                                        {normalizeBrand(item.brand)} · <span className="font-bold text-amber-300 font-mono">GHS {item.price.toFixed(2)}</span>
                                        {category === 'laptops' && ` · ${item.ram} RAM · ${item.storage}`}
                                        {category === 'phones' && ` · Storage: ${item.storage}`}
                                        {category === 'gadgets' && item.storage && item.storage !== 'None' && item.storage !== 'N/A' && ` · Capacity: ${item.storage}`}
                                      </p>

                                      {/* Inline Price Editor when active */}
                                      {isEditingThisPrice && (
                                        <div className="mt-3 flex items-center gap-2 flex-wrap bg-slate-950 p-3 rounded-xl border border-cyan-500/40 animate-fadeIn">
                                          <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1">
                                            <DollarSign className="h-3.5 w-3.5" /> Adjust Price (GHS):
                                          </span>
                                          <div className="relative">
                                            <input
                                              type="number"
                                              step="0.01"
                                              min="1"
                                              value={editPriceValue}
                                              onChange={e => setEditPriceValue(e.target.value)}
                                              onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  void handleSavePrice(item);
                                                } else if (e.key === 'Escape') {
                                                  handleCancelEditPrice();
                                                }
                                              }}
                                              placeholder="e.g. 4500.00"
                                              className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                                              autoFocus
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            disabled={priceSavingId === item.id}
                                            onClick={() => void handleSavePrice(item)}
                                            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-500/20"
                                          >
                                            {priceSavingId === item.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                            {priceSavingId === item.id ? 'Saving…' : 'Save Price'}
                                          </button>
                                          <button
                                            type="button"
                                            disabled={priceSavingId === item.id}
                                            onClick={handleCancelEditPrice}
                                            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {canEdit && !isEditingThisPrice && (
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditPrice(item)}
                                          className="text-xs px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                                          title="Edit price of this product"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                          Edit Price
                                        </button>
                                      )}
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleInventoryItem(item)}
                                          className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                                            item.active
                                              ? 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10'
                                              : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                                          }`}
                                        >
                                          {item.active ? 'Archive Listing' : 'Restore Listing'}
                                        </button>
                                      )}
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeletingProduct(item);
                                            setDeleteError('');
                                          }}
                                          className="text-xs px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                                          title="Permanently delete product"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </section>
                      </div>
                    )}

        {/* ================= CONTACT VIEW ================= */ }
        { activeTab === 'contact' && (
                      <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
                        <div className="rounded-3xl border border-cyan-500/30 bg-slate-900/80 p-8 shadow-xl space-y-6">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Customer Support & Orders</span>
                            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">Contact GKB Technologies</h2>
                            <p className="text-sm text-slate-300 mt-2">Have a question about a laptop, mobile phone, or electronic gadget? Need a custom spec or want to verify an order? Reach out to us directly.</p>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
                              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase">
                                <Phone className="h-4 w-4" /> Phone & WhatsApp
                              </div>
                              <p className="text-lg font-black text-white">0552117787</p>
                              <p className="text-xs text-slate-400">Available Monday – Saturday, 8AM to 8PM</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
                              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase">
                                <Mail className="h-4 w-4" /> Direct Email
                              </div>
                              <p className="text-lg font-black text-white">gkbtechnologies@gmail.com</p>
                              <p className="text-xs text-slate-400">Response within 2-4 hours</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
                              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
                                <Globe className="h-4 w-4" /> Nationwide Delivery
                              </div>
                              <p className="text-lg font-black text-white">Accra, Kumasi & All Regions</p>
                              <p className="text-xs text-slate-400">Fast delivery with payment verification</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
                              <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase">
                                <Shield className="h-4 w-4" /> GKB Hardware Guarantee
                              </div>
                              <p className="text-lg font-black text-white">Tested & Verified Hardware</p>
                              <p className="text-xs text-slate-400">Every device undergoes multi-point inspection</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </main>

                {/* Footer */}
                <footer className="border-t border-slate-800/80 bg-slate-950/80 py-8 text-center text-xs text-slate-500">
                  <p>© {new Date().getFullYear()} GKB Technologies. High-Performance Laptops, Mobile Devices & Electronics.</p>
                  <p className="mt-1 font-mono text-[10px] text-cyan-400/50">Engineered with Precision · Accra, Ghana</p>
                </footer>

                {/* Login / Signup Modal */}
                {loginModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="relative w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-950 p-6 text-white shadow-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <h3 className="text-lg font-bold">{creatingAccount ? 'Create GKB Account' : 'Sign in to GKB'}</h3>
                        <button
                          type="button"
                          onClick={() => setLoginModalOpen(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>

                      {loginError && (
                        <p className="text-xs text-red-300 bg-red-500/10 p-2.5 rounded-lg border border-red-500/30">{loginError}</p>
                      )}
                      {loginMessage && (
                        <p className="text-xs text-emerald-300 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/30">{loginMessage}</p>
                      )}

                      <form onSubmit={handleLoginSubmit} className="space-y-3 text-xs">
                        {creatingAccount && (
                          <div className="space-y-3">
                            <div>
                              <label className="text-slate-300 block mb-1 font-semibold">I want to register as:</label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSignupAccountType('client')}
                                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${signupAccountType === 'client'
                                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-400/40'
                                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                    }`}
                                >
                                  <User className="h-3.5 w-3.5" />
                                  Buyer / Client
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSignupAccountType('vendor')}
                                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${signupAccountType === 'vendor'
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm shadow-amber-500/20 ring-1 ring-amber-400/40'
                                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                    }`}
                                >
                                  <Store className="h-3.5 w-3.5 text-amber-400" />
                                  Vendor / Seller
                                </button>
                              </div>
                            </div>

                            {signupAccountType === 'vendor' && (
                              <label className="text-slate-300 block animate-fadeIn">
                                <span className="text-amber-300 font-bold flex items-center gap-1.5">
                                  <Store className="h-3.5 w-3.5 text-amber-400" /> Store / Business Name *
                                </span>
                                <input
                                  type="text"
                                  required
                                  value={signupBusinessName}
                                  onChange={e => setSignupBusinessName(e.target.value)}
                                  placeholder="e.g. Apex Laptops Hub, Swift Computers..."
                                  className="mt-1 w-full rounded-lg border border-amber-500/50 bg-slate-900 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-400 mt-1 block">
                                  Your store name will be displayed on all laptops and products you publish to the marketplace.
                                </span>
                              </label>
                            )}
                          </div>
                        )}

                        {creatingAccount && (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-slate-300">
                              First Name
                              <input
                                type="text"
                                required
                                value={signupFirstName}
                                onChange={e => setSignupFirstName(e.target.value)}
                                placeholder="e.g. Kwame"
                                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                              />
                            </label>
                            <label className="text-slate-300">
                              Last Name
                              <input
                                type="text"
                                required
                                value={signupLastName}
                                onChange={e => setSignupLastName(e.target.value)}
                                placeholder="e.g. Mensah"
                                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                              />
                            </label>
                          </div>
                        )}

                        <label className="text-slate-300 block">
                          Email Address or Phone Number
                          <input
                            type="text"
                            required
                            value={loginEmail}
                            onChange={e => setLoginEmail(e.target.value)}
                            placeholder="name@gmail.com or 0552117787"
                            className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                          />
                        </label>

                        {creatingAccount && (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-slate-300">
                              Phone Number
                              <input
                                type="tel"
                                required
                                value={signupPhone}
                                onChange={e => setSignupPhone(e.target.value)}
                                placeholder="0552117787"
                                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                              />
                            </label>
                            <label className="text-slate-300">
                              Delivery City / Town
                              <input
                                type="text"
                                required
                                value={signupLocation}
                                onChange={e => setSignupLocation(e.target.value)}
                                placeholder="Accra, Kumasi..."
                                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                              />
                            </label>
                          </div>
                        )}

                        <label className="text-slate-300 block">
                          Password
                          <input
                            type="password"
                            required
                            value={loginPassword}
                            onChange={e => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                          />
                        </label>

                        <button
                          type="submit"
                          disabled={loginBusy}
                          className="w-full mt-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 py-2.5 font-bold text-xs uppercase tracking-wider text-black shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {loginBusy ? 'Authenticating…' : (creatingAccount ? 'Complete Registration' : 'Sign In')}
                        </button>
                      </form>

                      <div className="text-center pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => {
                            setCreatingAccount(v => !v);
                            setLoginError('');
                            setLoginMessage('');
                          }}
                          className="text-xs text-cyan-400 hover:underline"
                        >
                          {creatingAccount ? 'Already registered? Sign in' : "Don't have an account? Sign up in 10 seconds"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Delete Confirmation Modal */}
                {deletingProduct && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="relative w-full max-w-md rounded-2xl border border-red-500/50 bg-slate-950 p-6 text-white shadow-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2 text-red-400">
                          <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                            <Trash2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white">Permanently Delete Product</h3>
                            <p className="text-[11px] text-red-400/80 font-medium">Confirmation required</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isDeleting) {
                              setDeletingProduct(null);
                              setDeleteError('');
                            }
                          }}
                          disabled={isDeleting}
                          className="text-slate-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer text-lg px-2"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <p className="text-slate-300 leading-relaxed">
                          Are you sure you want to permanently delete this product? It will be completely removed from the store catalog, database, and storage.
                          <span className="block text-red-300 font-semibold mt-1">⚠️ This action cannot be reversed.</span>
                        </p>

                        {/* Product Preview Card */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2">
                          <div className="flex items-center gap-3">
                            {deletingProduct.image_path && relaySupabase ? (
                              <img
                                src={relaySupabase.storage.from(inventoryImageBucket).getPublicUrl(deletingProduct.image_path).data.publicUrl}
                                alt={deletingProduct.title}
                                className="h-12 w-12 rounded-lg object-cover border border-slate-700 shrink-0 bg-slate-950"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 border border-slate-700">
                                <Package className="h-6 w-6" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-white text-sm truncate">{deletingProduct.title}</p>
                              <p className="text-slate-400 text-[11px] mt-0.5">
                                {normalizeBrand(deletingProduct.brand)} · <span className="font-mono text-amber-300 font-bold">GHS {deletingProduct.price.toFixed(2)}</span>
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {(deletingProduct.category || parseCategory(deletingProduct)).toUpperCase()}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {deletingProduct.vendorName || (deletingProduct.isOfficial ? 'GKB Official' : 'Direct Stock')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {deleteError && (
                          <p className="text-xs text-red-300 bg-red-500/10 p-3 rounded-lg border border-red-500/30 leading-relaxed">
                            {deleteError}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => {
                            setDeletingProduct(null);
                            setDeleteError('');
                          }}
                          className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => void handleConfirmDelete()}
                          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50"
                        >
                          {isDeleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          {isDeleting ? 'Deleting Permanently…' : 'Yes, Delete Permanently'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              );
}
