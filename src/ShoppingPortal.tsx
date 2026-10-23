import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { relaySupabase, relaySupabaseConfigError } from './supabase';
import OrdersPortal from './OrdersPortal';
import {
  ShoppingBag, Laptop, Package, Shield, Phone, Mail, Globe,
  User, Lock, LogOut, CheckCircle, AlertTriangle, ArrowRight,
  Sun, Moon, Zap, Tag, RefreshCw, PlusCircle, Search, Filter
} from 'lucide-react';

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
};

const inventoryRamOptions = ['4GB', '8GB', '16GB', '32GB', '64GB'];
const inventoryStorageOptions = ['128GB', '256GB', '512GB', '1TB', '2TB', '4TB'];
const inventoryImageBucket = 'gkb-device-images';

const initialDemoProducts: InventoryItem[] = [
  {
    id: 'demo-1',
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
    brand: 'Apple',
    title: 'MacBook Air M1 · Retina True Tone Display',
    highlights: 'Apple M1 Silicon 8-core CPU with extraordinary power efficiency. Silent fanless design, up to 18 hours battery life, P3 wide color gamut, Magic Keyboard with Touch ID.',
    price: 5800.00,
    ram: '8GB',
    storage: '256GB',
    image_path: '',
    active: true
  },
  {
    id: 'demo-5',
    brand: 'GKB Prototyping',
    title: 'GKB IoT Starter Kit · ESP32 + Sensor Suite',
    highlights: 'Complete student & developer hardware development package. Includes ESP32 DevKit, OLED display, DHT22 temp/humidity sensor, PIR motion detector, ultrasonic rangefinder, and 4-channel relay module.',
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
  }, [text]);

  return (
    <div className="relative">
      <p
        aria-hidden="true"
        ref={measurementRef}
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 whitespace-pre-line text-sm leading-relaxed opacity-0"
      >
        {text}
      </p>
      <p
        className="overflow-hidden whitespace-pre-line text-sm leading-relaxed text-slate-400 transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: `${expanded ? fullHeight : collapsedHeight}px` }}
      >
        {text}
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

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedOrderProduct, setSelectedOrderProduct] = useState('');
  const [selectedOrderPrice, setSelectedOrderPrice] = useState<number | null>(null);

  // Inventory state
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [inventoryMessage, setInventoryMessage] = useState('');
  const [inventoryBrand, setInventoryBrand] = useState('');
  const [inventoryTitle, setInventoryTitle] = useState('');
  const [inventoryHighlights, setInventoryHighlights] = useState('');
  const [inventoryPrice, setInventoryPrice] = useState('');
  const [inventoryRam, setInventoryRam] = useState(inventoryRamOptions[1]);
  const [inventoryStorage, setInventoryStorage] = useState(inventoryStorageOptions[2]);
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
    // Check saved client session for immediate recovery
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
        .select('id, brand, title, highlights, price, ram, storage, image_path, active')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Unable to load from Supabase gkb_inventory_items, using seed catalog.', error);
        setInventoryItems(initialDemoProducts);
      } else if (data && data.length > 0) {
        setInventoryItems(data.map(item => ({ ...item, price: Number(item.price) })));
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

        // Establish client account immediately so the order flow is uninterrupted
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

      // Just like Jumia: if user selected a product, transition directly into checkout!
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

      const { data, error } = await relaySupabase
        .from('gkb_inventory_items')
        .insert({
          brand: inventoryBrand.trim(),
          title: inventoryTitle.trim(),
          highlights: inventoryHighlights.trim(),
          price,
          ram: inventoryRam,
          storage: inventoryStorage,
          image_path: path
        })
        .select()
        .single();
      if (error) throw error;

      setInventoryItems(current => [{ ...data, price: Number(data.price) } as InventoryItem, ...current]);
      setInventoryBrand('');
      setInventoryTitle('');
      setInventoryHighlights('');
      setInventoryPrice('');
      setInventoryImage(null);
      setInventoryMessage('Product added to retail catalog successfully.');
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : 'Failed to add device.');
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
      setInventoryItems(current => current.map(dev => dev.id === item.id ? { ...data, price: Number(data.price) } as InventoryItem : dev));
    } catch (error) {
      console.error('Failed to update product state:', error);
    }
  };

  const handleOrderProduct = (product: InventoryItem) => {
    setSelectedOrderProduct(product.title);
    setSelectedOrderPrice(product.price);

    if (!user) {
      // Just like Jumia: prompt client to sign in or sign up before proceeding
      setLoginError('');
      setLoginMessage(`Please sign in or create an account to proceed with ordering "${product.brand} ${product.title}".`);
      setLoginModalOpen(true);
      return;
    }

    setActiveTab('order');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter products
  const displayItems = inventoryItems.filter(item => {
    if (user?.role !== 'admin' && !item.active) return false;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.highlights.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBrand = selectedBrand === 'All' || item.brand.toLowerCase() === selectedBrand.toLowerCase();
    return matchesSearch && matchesBrand;
  });

  const uniqueBrands = ['All', ...Array.from(new Set(inventoryItems.map(i => i.brand)))];

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
              <p className="hidden sm:block text-[10px] text-cyan-400/70 tracking-widest uppercase">Gadgets & Tech Hardware • Built Beyond Limits</p>
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
        <nav className="flex md:hidden gap-1 overflow-x-auto border-t border-slate-800/70 px-3 py-2">
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* ================= CATALOG VIEW ================= */}
        {activeTab === 'catalog' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Hero Banner */}
            <section className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 p-6 sm:p-10 shadow-[0_0_35px_rgba(6,182,212,0.15)]">
              <div className="max-w-2xl space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-300">
                  <Laptop className="h-3.5 w-3.5" /> GKB Retail Electronics
                </span>
                <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                  PREMIUM TECH GADGETS & HARDWARE
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Browse top-tier laptops, high-performance workstations, and custom microcontroller prototyping gear. Instant order placement with direct MTN Mobile Money checkout.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('order')}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-cyan-500/25 hover:opacity-90 transition-all"
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

            {/* Filter and Search Bar */}
            <div id="catalog-grid" className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search laptops, specs, brand, or model…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {/* Brand Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <Filter className="h-4 w-4 text-cyan-400 shrink-0 hidden sm:block" />
                {uniqueBrands.map(brand => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => setSelectedBrand(brand)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedBrand === brand
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {brand}
                  </button>
                ))}
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
                <p className="text-xs text-slate-400">Try adjusting your search query or brand filter.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {displayItems.map(item => {
                  const imageUrl = item.image_path && relaySupabase
                    ? relaySupabase.storage.from(inventoryImageBucket).getPublicUrl(item.image_path).data.publicUrl
                    : null;

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
                              <Laptop className="h-14 w-14 text-cyan-500/40" />
                              <span className="mt-2 text-xs font-mono uppercase tracking-wider text-slate-500">{item.brand} GKB Hardware</span>
                            </div>
                          )}
                          <span className="absolute top-3 left-3 rounded-full bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                            {item.brand}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="p-5 space-y-3">
                          <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {item.title}
                          </h3>

                          {/* Spec Badges */}
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-purple-300">
                              {item.ram} RAM
                            </span>
                            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-300">
                              {item.storage}
                            </span>
                            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                              Verified Stock
                            </span>
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
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-md shadow-cyan-500/20 hover:scale-105 transition-all"
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
              <h3 className="text-xl font-bold text-white">Add a Retail Product Listing</h3>
              <p className="mt-2 text-sm text-slate-400">Add a laptop, PC, or electronic gadget listing to the live store.</p>
              
              <form onSubmit={handleAddInventoryItem} className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-slate-300">
                  Brand
                  <input
                    type="text"
                    value={inventoryBrand}
                    onChange={e => setInventoryBrand(e.target.value)}
                    maxLength={100}
                    required
                    placeholder="HP, Dell, Apple, Lenovo, etc."
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Product Title & Model
                  <input
                    type="text"
                    value={inventoryTitle}
                    onChange={e => setInventoryTitle(e.target.value)}
                    maxLength={160}
                    required
                    placeholder="HP EliteBook 840 G7 14.0' FHD"
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Price in GHS
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={inventoryPrice}
                    onChange={e => setInventoryPrice(e.target.value)}
                    required
                    placeholder="3500.00"
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Installed RAM
                  <select
                    value={inventoryRam}
                    onChange={e => setInventoryRam(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {inventoryRamOptions.map(opt => <option key={opt}>{opt}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-300">
                  Storage
                  <select
                    value={inventoryStorage}
                    onChange={e => setInventoryStorage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {inventoryStorageOptions.map(opt => <option key={opt}>{opt}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-300">
                  Product Image (JPG, PNG, WebP)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => setInventoryImage(e.target.files?.[0] ?? null)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-300"
                  />
                </label>
                <label className="text-xs text-slate-300 sm:col-span-2">
                  Key Specs & Highlights
                  <textarea
                    rows={3}
                    value={inventoryHighlights}
                    onChange={e => setInventoryHighlights(e.target.value)}
                    required
                    placeholder="Key features, processor, battery health, display specs..."
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
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
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-all disabled:opacity-50"
                  >
                    <PlusCircle className="h-4 w-4" />
                    {inventoryBusy ? 'Publishing…' : 'Publish Product to Store'}
                  </button>
                </div>
              </form>
            </section>

            {/* Existing Inventory Management Table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-4">
              <h3 className="text-lg font-bold text-white">Current Listings ({inventoryItems.length})</h3>
              <div className="divide-y divide-slate-800">
                {inventoryItems.map(item => (
                  <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{item.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                          {item.active ? 'ACTIVE' : 'ARCHIVED'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">GHS {item.price.toFixed(2)} · {item.ram} · {item.storage}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleInventoryItem(item)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                        item.active
                          ? 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10'
                          : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                      }`}
                    >
                      {item.active ? 'Archive Listing' : 'Restore Listing'}
                    </button>
                  </div>
                ))}
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
                <p className="text-sm text-slate-300 mt-2">Have a question about a laptop, need a specific spec, or want to verify an order? Reach out to us directly.</p>
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
                    <Mail className="h-4 w-4" /> Official Email
                  </div>
                  <p className="text-base font-bold text-white">zumkel023@gmail.com</p>
                  <p className="text-xs text-slate-400">Direct response within 2 hours</p>
                </div>
              </div>

              {/* MoMo Verification Reminder */}
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5 space-y-2">
                <h4 className="text-sm font-bold text-yellow-200">MTN Mobile Money Verification</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Before confirming any payment on your phone, always verify the registered MoMo name: <strong className="text-white">zumah kelvin🥳😍</strong> (Number: <strong className="text-yellow-200">0552117787</strong>).
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} GKB Technologies. Built Beyond Limits. All rights reserved.</p>
          <div className="flex gap-4 text-slate-400">
            <button type="button" onClick={() => setActiveTab('catalog')} className="hover:text-cyan-300">Catalog</button>
            <button type="button" onClick={() => setActiveTab('order')} className="hover:text-cyan-300">Track Orders</button>
            <button type="button" onClick={() => setActiveTab('contact')} className="hover:text-cyan-300">Contact</button>
          </div>
        </div>
      </footer>

      {/* Login / Signup Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-900 p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.3)] space-y-5 animate-scaleUp">
            <div className="text-center space-y-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                ⚡ GKB Secure Checkout
              </span>
              <h3 className="text-xl font-black text-white">
                {creatingAccount ? 'Create Client Account' : 'Sign in to GKB Store'}
              </h3>
              <p className="text-xs text-slate-400">
                {creatingAccount ? 'Register in 30 seconds to prefill your delivery details and track orders.' : 'Sign in to review your orders and proceed with your purchase.'}
              </p>
            </div>

            {/* Jumia-style selected item banner */}
            {selectedOrderProduct && (
              <div className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-950/50 p-3 text-left">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Order in Progress</p>
                    <p className="truncate text-xs font-bold text-white">{selectedOrderProduct}</p>
                  </div>
                </div>
                {selectedOrderPrice !== null && (
                  <span className="shrink-0 text-xs font-black text-yellow-300 ml-2">
                    GHS {selectedOrderPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            )}

            {/* Jumia-style Tabs */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCreatingAccount(false);
                  setLoginError('');
                  setLoginMessage('');
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                  !creatingAccount ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingAccount(true);
                  setLoginError('');
                  setLoginMessage('');
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                  creatingAccount ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {loginError && (
              <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                {loginError}
              </p>
            )}
            {loginMessage && (
              <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg">
                {loginMessage}
              </p>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              {creatingAccount && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-slate-400">
                      First Name
                      <input
                        type="text"
                        value={signupFirstName}
                        onChange={e => setSignupFirstName(e.target.value)}
                        required
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white text-sm focus:border-cyan-400 focus:outline-none"
                      />
                    </label>
                    <label className="text-slate-400">
                      Last Name
                      <input
                        type="text"
                        value={signupLastName}
                        onChange={e => setSignupLastName(e.target.value)}
                        required
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white text-sm focus:border-cyan-400 focus:outline-none"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-slate-400">
                      Phone Number
                      <input
                        type="tel"
                        value={signupPhone}
                        onChange={e => setSignupPhone(e.target.value)}
                        required
                        placeholder="024XXXXXXX"
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white text-sm focus:border-cyan-400 focus:outline-none"
                      />
                    </label>
                    <label className="text-slate-400">
                      Location / Town
                      <input
                        type="text"
                        value={signupLocation}
                        onChange={e => setSignupLocation(e.target.value)}
                        required
                        placeholder="Accra, Kumasi..."
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white text-sm focus:border-cyan-400 focus:outline-none"
                      />
                    </label>
                  </div>
                </>
              )}

              <label className="block text-slate-400">
                Email Address
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-white text-sm focus:border-cyan-400 focus:outline-none"
                />
              </label>

              <label className="block text-slate-400">
                Password
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-white text-sm focus:border-cyan-400 focus:outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={loginBusy}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-bold rounded-lg text-sm shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {loginBusy ? 'Working…' : creatingAccount ? 'Create Client Account' : 'Sign In'}
              </button>
            </form>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCreatingAccount(!creatingAccount);
                  setLoginError('');
                  setLoginMessage('');
                }}
                className="text-cyan-300 hover:text-cyan-200"
              >
                {creatingAccount ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
