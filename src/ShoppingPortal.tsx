import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { relaySupabase, relaySupabaseConfigError } from './supabase';
import OrdersPortal from './OrdersPortal';
import {
  ShoppingBag, Laptop, Package, Shield, Phone, Mail, Globe,
  User, Lock, LogOut, CheckCircle, AlertTriangle, ArrowRight,
  Sun, Moon, Zap, Tag, RefreshCw, PlusCircle, Search, Filter,
  Smartphone, HardDrive, Layers, Cpu, Copy, Check, Info,
  SlidersHorizontal, Sparkles, Folder
} from 'lucide-react';

export type ProductCategory = 'laptops' | 'phones' | 'gadgets';

type UserType = {
  id: string;
  role: 'admin' | 'client';
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  location: string;
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
  if (item.category) {
    const c = item.category.toLowerCase();
    if (c.includes('phone') || c.includes('mobile')) return 'phones';
    if (c.includes('gadget') || c.includes('accessory') || c.includes('hardware')) return 'gadgets';
    return 'laptops';
  }
  const text = `${item.title || ''} ${item.brand || ''} ${item.highlights || ''}`.toLowerCase();
  if (
    text.includes('[category: mobile phones]') ||
    text.includes('[category: phones]') ||
    text.includes('iphone') ||
    text.includes('smartphone') ||
    text.includes('samsung galaxy') ||
    text.includes('tecno') ||
    text.includes('infinix') ||
    text.includes('google pixel') ||
    text.includes('xiaomi') ||
    text.includes('redmi') ||
    text.includes('oppo') ||
    text.includes('vivo')
  ) {
    return 'phones';
  }
  if (
    text.includes('[category: electronic gadgets]') ||
    text.includes('[category: gadgets]') ||
    text.includes('hard drive') ||
    text.includes('hdd') ||
    text.includes('ssd') ||
    text.includes('laptop stand') ||
    text.includes('stand') ||
    text.includes('mouse') ||
    text.includes('keyboard') ||
    text.includes('power bank') ||
    text.includes('charger') ||
    text.includes('hub') ||
    text.includes('adapter') ||
    text.includes('starter kit') ||
    text.includes('esp32') ||
    text.includes('gadget')
  ) {
    return 'gadgets';
  }
  return 'laptops';
}

export function parseGadgetType(highlights: string): string {
  const match = highlights.match(/\[Category:[^|\]]*\|\s*Type:\s*([^\]]+)\]/i);
  if (match && match[1]) return match[1].trim();
  const h = highlights.toLowerCase();
  if (h.includes('hard drive') || h.includes('hdd') || h.includes('ssd')) return 'External Hard Drive / SSD';
  if (h.includes('stand') || h.includes('cooling pad')) return 'Laptop Stand / Cooling Pad';
  if (h.includes('mouse') || h.includes('keyboard')) return 'Wireless Mouse / Keyboard';
  if (h.includes('charger') || h.includes('power bank')) return 'Power Bank / Fast Charger';
  if (h.includes('hub') || h.includes('dock')) return 'USB-C Hub / Docking Station';
  if (h.includes('headphone') || h.includes('earbud') || h.includes('audio')) return 'Headphones & Audio';
  if (h.includes('iot') || h.includes('esp32') || h.includes('sensor')) return 'Smart IoT & Hardware';
  return 'Electronic Gadget';
}

// Clean highlights text by stripping the internal metadata tag for display
export function cleanHighlights(text: string): string {
  return text.replace(/\[Category:[^\]]+\]\s*/g, '').trim();
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
    ram: '6GB',
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
    ram: '12GB',
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
    ram: '8GB',
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

  useEffect(() => {
    window.localStorage.setItem('gkb-theme', isLightMode ? 'light' : 'dark');
  }, [isLightMode]);

  // Auth session management
  const applyPortalSession = useCallback(async (session: Session | null) => {
    if (!session?.user.email && !session?.user.phone) {
      setUser(null);
      return;
    }

    const metadata = session.user.user_metadata;
    const account: UserType = {
      id: session.user.id,
      role: 'client',
      email: session.user.email ?? session.user.phone ?? '',
      firstName: typeof metadata.first_name === 'string' ? metadata.first_name : '',
      lastName: typeof metadata.last_name === 'string' ? metadata.last_name : '',
      phone: typeof metadata.phone === 'string' ? metadata.phone : '',
      location: typeof metadata.location === 'string' ? metadata.location : ''
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

    const role = (data?.role === 'admin' || session.user.email?.toLowerCase() === 'zumkel023@gmail.com') ? 'admin' : 'client';
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
          const gadgetType = category === 'gadgets' ? parseGadgetType(item.highlights || '') : undefined;
          return {
            ...item,
            price: Number(item.price),
            category,
            gadgetType
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
        const { data, error } = await relaySupabase.auth.signUp({
          email: loginEmail.trim(),
          password: loginPassword,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              first_name: signupFirstName.trim(),
              last_name: signupLastName.trim(),
              phone: signupPhone.trim(),
              location: signupLocation.trim()
            }
          }
        });
        if (error) throw error;

        const clientAccount: UserType = {
          id: data.user?.id || ('client-' + Date.now()),
          role: 'client',
          email: loginEmail.trim(),
          firstName: signupFirstName.trim(),
          lastName: signupLastName.trim(),
          phone: signupPhone.trim(),
          location: signupLocation.trim()
        };
        setUser(clientAccount);
        window.localStorage.setItem('gkb_client_session', JSON.stringify(clientAccount));
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
  const handleAddInventoryItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInventoryError('');
    setInventoryMessage('');
    if (user?.role !== 'admin' || !relaySupabase) {
      setInventoryError('Only administrators can add retail inventory.');
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

    const effectiveBrand = inventoryBrandSelect === 'Other (Custom Brand)'
      ? (inventoryCustomBrand.trim() || 'Custom Brand')
      : inventoryBrandSelect;

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

      const enrichedHighlights = `${categoryTag}\n${inventoryHighlights.trim()}`;

      // In case database has strict check constraint on ram/storage, provide fallback valid values
      const dbRam = inventoryCategory === 'gadgets' ? '4GB' : inventoryRam;
      const dbStorage = inventoryCategory === 'gadgets'
        ? (inventoryGadgetCapacity.includes('GB') || inventoryGadgetCapacity.includes('TB') ? inventoryGadgetCapacity : '128GB')
        : inventoryStorage;

      const payload: Record<string, any> = {
        brand: effectiveBrand,
        title: inventoryTitle.trim(),
        highlights: enrichedHighlights,
        price,
        ram: dbRam,
        storage: dbStorage,
        image_path: path
      };

      // Try inserting with category column if it exists in Supabase
      let result = await relaySupabase
        .from('gkb_inventory_items')
        .insert({ ...payload, category: inventoryCategory })
        .select()
        .single();

      // Graceful fallback if category column doesn't exist yet in Supabase
      if (result.error && result.error.message && result.error.message.includes('category')) {
        result = await relaySupabase
          .from('gkb_inventory_items')
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;
      const data = result.data;

      const newItem: InventoryItem = {
        ...data,
        price: Number(data.price),
        category: inventoryCategory,
        gadgetType: inventoryCategory === 'gadgets' ? inventoryGadgetType : undefined,
        storage: inventoryCategory === 'gadgets' && inventoryGadgetCapacity !== 'None / N/A' ? inventoryGadgetCapacity : data.storage,
        ram: inventoryCategory === 'gadgets' ? 'N/A' : data.ram
      };

      setInventoryItems(current => [newItem, ...current]);
      setInventoryTitle('');
      setInventoryHighlights('');
      setInventoryPrice('');
      setInventoryCustomBrand('');
      setInventoryImage(null);
      setInventoryMessage(`${categoryLabel} published to store catalog successfully.`);
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : 'Failed to add product.');
    } finally {
      setInventoryBusy(false);
    }
  };

  // Archive item toggle
  const handleToggleInventoryItem = async (item: InventoryItem) => {
    if (user?.role !== 'admin' || !relaySupabase) return;
    try {
      const { data, error } = await relaySupabase
        .from('gkb_inventory_items')
        .update({ active: !item.active, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .select()
        .single();
      if (error) throw error;
      setInventoryItems(current => current.map(dev => dev.id === item.id ? { ...data, price: Number(data.price), category: item.category, gadgetType: item.gadgetType } as InventoryItem : dev));
    } catch (error) {
      console.error('Failed to update product state:', error);
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
      setInventoryRam(phoneRamOptions[2]); // 6GB
      setInventoryStorage(phoneStorageOptions[1]); // 128GB
    } else {
      setInventoryBrandSelect(gadgetBrandOptions[0]);
      setInventoryGadgetType(gadgetTypeOptions[0]);
      setInventoryGadgetCapacity(gadgetCapacityOptions[5]); // 1TB
      setInventoryRam('N/A');
    }
  };

  // Filter products by category, gadgetType, search, and brand
  const displayItems = inventoryItems.filter(item => {
    if (user?.role !== 'admin' && !item.active) return false;
    const category = item.category || parseCategory(item);
    const matchesCategory = selectedCategory === 'all' || category === selectedCategory;

    const matchesGadgetType = selectedCategory !== 'gadgets' || selectedGadgetType === 'all' || (
      (item.gadgetType && item.gadgetType.toLowerCase().includes(selectedGadgetType.toLowerCase())) ||
      item.highlights.toLowerCase().includes(selectedGadgetType.toLowerCase())
    );

    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cleanHighlights(item.highlights).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBrand = selectedBrand === 'All' || item.brand.toLowerCase() === selectedBrand.toLowerCase();

    return matchesCategory && matchesGadgetType && matchesSearch && matchesBrand;
  });

  const uniqueBrands = ['All', ...Array.from(new Set(
    inventoryItems
      .filter(item => selectedCategory === 'all' || (item.category || parseCategory(item)) === selectedCategory)
      .map(i => i.brand)
  ))];

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
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setActiveTab('admin-inventory')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'admin-inventory' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'text-slate-400 hover:text-purple-300'}`}
              >
                Manage Inventory
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
                {(user.role === 'admin' || user.email?.toLowerCase() === 'zumkel023@gmail.com') ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold font-mono tracking-wider text-amber-300">
                    <Shield className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                    Admin
                  </span>
                ) : (
                  <span className="text-xs text-purple-300 font-mono truncate max-w-[72px] sm:max-w-[120px]">{user.email}</span>
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
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('admin-inventory')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${activeTab === 'admin-inventory' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400'}`}
            >
              Inventory
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
            {/* Hero Banner */}
            <section className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 p-8 sm:p-12 shadow-2xl">
              <div className="relative z-10 max-w-2xl space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold font-mono tracking-wider text-cyan-300 uppercase">
                  <Sparkles className="h-3.5 w-3.5" /> GKB Tech & Electronics Marketplace
                </span>
                <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                  Premium <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400">Laptops, Phones</span> & Electronic Gadgets
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Verified stock with nationwide Ghana delivery. From top-tier engineering workstations and MacBooks to the latest smartphones, hard drives, and custom tech gear.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('order')}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-5 py-3 text-sm font-bold text-black shadow-lg shadow-cyan-500/25 hover:scale-105 transition-all"
                  >
                    <ShoppingBag className="h-4 w-4" /> Place an Order
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('catalog-grid');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Browse Listings
                  </button>
                </div>
              </div>
            </section>

            {/* Category Selector Tabs */}
            <div id="catalog-grid" className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedCategory('all'); setSelectedBrand('All'); }}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'gkb-store-tab-active bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25 border border-cyan-400'
                      : 'gkb-store-tab-inactive bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>All Items</span>
                  <span className="ml-1 text-[11px] font-mono opacity-80">
                    ({inventoryItems.filter(i => user?.role === 'admin' || i.active).length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setSelectedCategory('laptops'); setSelectedBrand('All'); }}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    selectedCategory === 'laptops'
                      ? 'gkb-store-tab-active bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25 border border-cyan-400'
                      : 'gkb-store-tab-inactive bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300'
                  }`}
                >
                  <Laptop className="h-4 w-4" />
                  <span>Laptops & Computers</span>
                  <span className="ml-1 text-[11px] font-mono opacity-80">
                    ({inventoryItems.filter(i => (user?.role === 'admin' || i.active) && (i.category || parseCategory(i)) === 'laptops').length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setSelectedCategory('phones'); setSelectedBrand('All'); }}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    selectedCategory === 'phones'
                      ? 'gkb-store-tab-active bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25 border border-cyan-400'
                      : 'gkb-store-tab-inactive bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300'
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Mobile Phones</span>
                  <span className="ml-1 text-[11px] font-mono opacity-80">
                    ({inventoryItems.filter(i => (user?.role === 'admin' || i.active) && (i.category || parseCategory(i)) === 'phones').length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setSelectedCategory('gadgets'); setSelectedBrand('All'); }}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    selectedCategory === 'gadgets'
                      ? 'gkb-store-tab-active bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25 border border-cyan-400'
                      : 'gkb-store-tab-inactive bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300'
                  }`}
                >
                  <HardDrive className="h-4 w-4" />
                  <span>Electronic Gadgets</span>
                  <span className="ml-1 text-[11px] font-mono opacity-80">
                    ({inventoryItems.filter(i => (user?.role === 'admin' || i.active) && (i.category || parseCategory(i)) === 'gadgets').length})
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
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        selectedGadgetType === sub.key
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
                  <Filter className="h-4 w-4 text-cyan-400 shrink-0 hidden sm:block" />
                  {uniqueBrands.map(brand => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setSelectedBrand(brand)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        selectedBrand === brand
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
                                {item.brand} · {isPhone ? 'Mobile Handset' : isGadget ? 'Electronic Gadget' : 'Laptop Workstation'}
                              </span>
                            </div>
                          )}

                          {/* Category & Brand Badges */}
                          <div className="absolute top-3 left-3 flex items-center gap-1.5">
                            <span className="rounded-full bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                              {item.brand}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wide border ${
                              isPhone
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : isGadget
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            }`}>
                              {isPhone ? 'Phone' : isGadget ? 'Gadget' : 'Laptop'}
                            </span>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="p-5 space-y-3">
                          <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {item.title}
                          </h3>

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
                                <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-300">
                                  {item.storage} Space
                                </span>
                                <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-purple-300">
                                  {item.ram} RAM
                                </span>
                                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                                  Smartphone Stock
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
                      <div className="border-t border-slate-800/80 p-5 pt-4 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Cash / MoMo Price</p>
                          <p className="text-xl font-black text-yellow-300">
                            GHS {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
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

        {/* ================= ADMIN INVENTORY VIEW ================= */}
        {activeTab === 'admin-inventory' && user?.role === 'admin' && (
          <div className="space-y-8 animate-fadeIn">
            <section className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Add a Retail Product Listing</h3>
                  <p className="mt-1 text-sm text-slate-400">Upload a Laptop, Mobile Phone, or Electronic Gadget to the live store.</p>
                </div>

                {/* Database Schema helper trigger */}
                <button
                  type="button"
                  onClick={() => setShowSqlHelper(v => !v)}
                  className="gkb-sql-helper-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 text-xs font-mono font-medium transition-all cursor-pointer self-start sm:self-auto"
                >
                  <Cpu className="h-3.5 w-3.5" />
                  {showSqlHelper ? 'Hide SQL Migration' : 'Supabase SQL Helper'}
                </button>
              </div>

              {/* Optional SQL Migration Card for Admin */}
              {showSqlHelper && (
                <div className="mt-4 p-4 rounded-xl border border-slate-700 bg-slate-950/90 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono text-cyan-400 font-bold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Optional: Supabase Schema Upgrade SQL
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const sql = `-- GKB Shopping Portal Multi-Category Schema Migration\nALTER TABLE public.gkb_inventory_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'laptops';\nALTER TABLE public.gkb_inventory_items DROP CONSTRAINT IF EXISTS gkb_inventory_items_ram_check;\nALTER TABLE public.gkb_inventory_items DROP CONSTRAINT IF EXISTS gkb_inventory_items_storage_check;\nALTER TABLE public.gkb_inventory_items ALTER COLUMN ram DROP NOT NULL;\nALTER TABLE public.gkb_inventory_items ALTER COLUMN storage DROP NOT NULL;`;
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
{`-- Run once in Supabase SQL Editor if you want native category columns:
ALTER TABLE public.gkb_inventory_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'laptops';
ALTER TABLE public.gkb_inventory_items DROP CONSTRAINT IF EXISTS gkb_inventory_items_ram_check;
ALTER TABLE public.gkb_inventory_items DROP CONSTRAINT IF EXISTS gkb_inventory_items_storage_check;`}
                  </pre>
                  <p className="text-[11px] text-slate-400">
                    *Note: Our portal automatically preserves all categories and specs in highlights metadata even if you haven't run the SQL yet!
                  </p>
                </div>
              )}
              
              <form onSubmit={handleAddInventoryItem} className="mt-6 grid gap-4 sm:grid-cols-2">
                {/* 1. Main Category Dropdown */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-cyan-400 dark:text-cyan-300 uppercase tracking-wider block mb-2">
                    Select Product Category
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleAdminCategoryChange('laptops')}
                      className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        inventoryCategory === 'laptops'
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
                      className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        inventoryCategory === 'phones'
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
                      className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        inventoryCategory === 'gadgets'
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
                  <>
                    <label className="text-xs font-semibold text-slate-300">
                      Mobile Internal Storage (Space)
                      <select
                        value={inventoryStorage}
                        onChange={e => setInventoryStorage(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                      >
                        {phoneStorageOptions.map(opt => <option key={opt}>{opt}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-300">
                      Phone RAM
                      <select
                        value={inventoryRam}
                        onChange={e => setInventoryRam(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
                      >
                        {phoneRamOptions.map(opt => <option key={opt}>{opt}</option>)}
                      </select>
                    </label>
                  </>
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
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Current Listings ({inventoryItems.length})</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {inventoryItems.filter(i => (i.category || parseCategory(i)) === 'laptops').length} Laptops · {inventoryItems.filter(i => (i.category || parseCategory(i)) === 'phones').length} Phones · {inventoryItems.filter(i => (i.category || parseCategory(i)) === 'gadgets').length} Gadgets
                </span>
              </div>
              <div className="divide-y divide-slate-800">
                {inventoryItems.map(item => {
                  const category = item.category || parseCategory(item);
                  return (
                    <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{item.title}</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            category === 'phones'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : category === 'gadgets'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}>
                            {category === 'phones' ? 'PHONE' : category === 'gadgets' ? 'GADGET' : 'LAPTOP'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                            {item.active ? 'ACTIVE' : 'ARCHIVED'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {item.brand} · GHS {item.price.toFixed(2)}
                          {category !== 'gadgets' && ` · ${item.ram} RAM · ${item.storage}`}
                          {category === 'gadgets' && item.storage && item.storage !== 'None' && item.storage !== 'N/A' && ` · Capacity: ${item.storage}`}
                        </p>
                      </div>
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
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ================= CONTACT VIEW ================= */}
        {activeTab === 'contact' && (
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
    </div>
  );
}
