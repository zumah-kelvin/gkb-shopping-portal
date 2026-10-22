import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock3, Package, RefreshCw, ShoppingBag, ArrowLeft, MessageSquare, User } from 'lucide-react';
import { relaySupabase } from './supabase';

type OrderStatus = 'pending' | 'processing' | 'delivered' | 'picked_up';
type FulfillmentMethod = 'delivery' | 'pickup';

export type Order = {
  id: string;
  user_id: string;
  customer_email: string;
  product_name: string;
  quantity: number;
  customer_name: string;
  customer_phone: string;
  fulfillment_method: FulfillmentMethod;
  delivery_address: string;
  status: OrderStatus;
  created_at: string;
  status_updated_at: string;
};

export type PortalUser = {
  id: string;
  email: string;
  role: 'admin' | 'client';
  firstName?: string;
  lastName?: string;
  phone?: string;
  location?: string;
};

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Awaiting review',
  processing: 'Processing',
  delivered: 'Delivered',
  picked_up: 'Picked up'
};

const statusStyles: Record<OrderStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  processing: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  delivered: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  picked_up: 'border-purple-500/30 bg-purple-500/10 text-purple-200'
};

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected order error occurred.';
}

export default function OrdersPortal({
  user = null,
  initialProductName = '',
  initialProductPrice = null,
  initialPrice,
  onOrderSubmitted,
  onBack,
  onOpenLogin
}: {
  user?: PortalUser | null;
  initialProductName?: string;
  initialProductPrice?: number | null;
  initialPrice?: number | null;
  onOrderSubmitted?: () => void;
  onBack?: () => void;
  onOpenLogin?: () => void;
}) {
  const effectivePrice = initialProductPrice ?? initialPrice ?? null;
  const isAdmin = Boolean(user && user.role === 'admin');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState('');
  const [productName, setProductName] = useState(initialProductName);
  const [orderConfirmation, setOrderConfirmation] = useState<{
    productName: string;
    quantity: number;
    total: number | null;
    orderId: string;
    whatsappUrl?: string;
  } | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [customerName, setCustomerName] = useState(() =>
    user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : ''
  );
  const [customerPhone, setCustomerPhone] = useState(user?.phone ?? '');
  const [customerEmail, setCustomerEmail] = useState(user?.email ?? '');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState(user?.location ?? '');

  useEffect(() => {
    if (initialProductName) setProductName(initialProductName);
  }, [initialProductName]);

  // Update fields if user logs in later
  useEffect(() => {
    if (user) {
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
      if (fullName) setCustomerName(fullName);
      if (user.phone) setCustomerPhone(user.phone);
      if (user.email) setCustomerEmail(user.email);
      if (user.location) setDeliveryAddress(user.location);
    }
  }, [user]);

  const loadOrders = useCallback(async (showLoading = false) => {
    if (!relaySupabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);

    try {
      // If user is admin, query all orders
      if (isAdmin) {
        const { data, error: queryError } = await relaySupabase
          .from('gkb_orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (queryError) {
          setError(`Orders could not be loaded: ${queryError.message}`);
        } else {
          setOrders((data as Order[]) || []);
          setError('');
        }
      } else if (user) {
        // Authenticated client
        const { data, error: queryError } = await relaySupabase
          .from('gkb_orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (queryError) {
          // Fallback to checking by email
          const { data: emailData, error: emailError } = await relaySupabase
            .from('gkb_orders')
            .select('*')
            .eq('customer_email', user.email)
            .order('created_at', { ascending: false });

          if (!emailError && emailData) {
            setOrders(emailData as Order[]);
            setError('');
          } else {
            setError(`Orders could not be loaded: ${queryError.message}`);
          }
        } else {
          setOrders((data as Order[]) || []);
          setError('');
        }
      } else {
        // Guest user: load orders saved in localStorage
        try {
          const stored = window.localStorage.getItem('gkb_guest_orders');
          const guestList = stored ? (JSON.parse(stored) as Order[]) : [];
          setOrders(guestList);
          setError('');
        } catch {
          setOrders([]);
        }
      }
    } catch (queryError) {
      setError(`Orders could not be loaded: ${errorMessage(queryError)}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    void loadOrders(true);

    if (!relaySupabase || !user) {
      return;
    }

    const channel = relaySupabase
      .channel(`gkb-orders-${user.id || 'public'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gkb_orders' }, () => {
        void loadOrders();
      })
      .subscribe();

    const refreshId = window.setInterval(() => void loadOrders(), 15000);

    return () => {
      window.clearInterval(refreshId);
      void relaySupabase?.removeChannel(channel);
    };
  }, [loadOrders, user]);

  const handleSubmitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 999) {
      setFormError('Quantity must be a whole number between 1 and 999.');
      return;
    }
    if (fulfillmentMethod === 'delivery' && !deliveryAddress.trim()) {
      setFormError('Enter a delivery address or choose pickup.');
      return;
    }
    if (!customerPhone.trim()) {
      setFormError('Please enter a valid phone number so we can confirm your order.');
      return;
    }

    setSaving(true);
    const orderedProduct = productName.trim();
    const calculatedTotal = effectivePrice === null ? null : effectivePrice * parsedQuantity;
    const generatedRefId = `GKB-ORD-${Date.now().toString().slice(-6)}`;

    // Prepare WhatsApp fallback link with order specs
    const waText = encodeURIComponent(
      `*GKB TECHNOLOGIES — NEW ORDER PLACED*\n-----------------------------------------\n*Order Ref:* ${generatedRefId}\n*Item:* ${orderedProduct}\n*Quantity:* ${parsedQuantity}\n*Total Price:* ${calculatedTotal ? `GHS ${calculatedTotal.toLocaleString()}` : 'To be confirmed'}\n*Customer:* ${customerName.trim()}\n*Phone:* ${customerPhone.trim()}\n*Email:* ${customerEmail.trim() || 'N/A'}\n*Fulfillment:* ${fulfillmentMethod.toUpperCase()}\n${fulfillmentMethod === 'delivery' ? `*Delivery Address:* ${deliveryAddress.trim()}\n` : ''}-----------------------------------------\nPayment sent via MTN MoMo to: 0552117787 (zumah kelvin)`
    );
    const whatsappUrl = `https://wa.me/233552117787?text=${waText}`;

    try {
      let finalOrderId = generatedRefId;

      if (relaySupabase) {
        try {
          const { data: createdOrder, error: insertError } = await relaySupabase
            .from('gkb_orders')
            .insert({
              user_id: user?.id ?? `guest_${Date.now()}`,
              customer_email: customerEmail.trim() || user?.email || 'guest@gkbtechnologies.com',
              product_name: orderedProduct,
              quantity: parsedQuantity,
              customer_name: customerName.trim(),
              customer_phone: customerPhone.trim(),
              fulfillment_method: fulfillmentMethod,
              delivery_address: fulfillmentMethod === 'delivery' ? deliveryAddress.trim() : ''
            })
            .select('id')
            .single();

          if (!insertError && createdOrder?.id) {
            finalOrderId = createdOrder.id;
          }
        } catch (dbErr) {
          console.warn('Database insert warning, proceeding with order tracking reference:', dbErr);
        }
      }

      // Save to local guest storage for persistent tracking
      try {
        const stored = window.localStorage.getItem('gkb_guest_orders');
        const list = stored ? (JSON.parse(stored) as Order[]) : [];
        const newOrderObj: Order = {
          id: finalOrderId,
          user_id: user?.id ?? 'guest',
          customer_email: customerEmail.trim(),
          product_name: orderedProduct,
          quantity: parsedQuantity,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          fulfillment_method: fulfillmentMethod,
          delivery_address: fulfillmentMethod === 'delivery' ? deliveryAddress.trim() : '',
          status: 'pending',
          created_at: new Date().toISOString(),
          status_updated_at: new Date().toISOString()
        };
        list.unshift(newOrderObj);
        window.localStorage.setItem('gkb_guest_orders', JSON.stringify(list));
        setOrders(list);
      } catch {
        // Ignore local storage error
      }

      setOrderConfirmation({
        productName: orderedProduct,
        quantity: parsedQuantity,
        total: calculatedTotal,
        orderId: finalOrderId,
        whatsappUrl
      });

      setProductName('');
      setQuantity('1');
      if (!user) {
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setDeliveryAddress('');
      }
      setFulfillmentMethod('delivery');
      setSuccessMessage('Order placed successfully! Please review payment instructions below.');
      onOrderSubmitted?.();
    } catch (submitError) {
      setFormError(`Order could not be processed: ${errorMessage(submitError)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (order: Order, nextStatus: OrderStatus) => {
    if (!relaySupabase || order.status === nextStatus) return;
    setUpdatingOrderId(order.id);
    setError('');
    try {
      const { error: updateError } = await relaySupabase
        .from('gkb_orders')
        .update({ status: nextStatus, status_updated_at: new Date().toISOString() })
        .eq('id', order.id);

      if (updateError) throw updateError;
      await loadOrders();
    } catch (updateError) {
      setError(`Order status could not be updated: ${errorMessage(updateError)}`);
    } finally {
      setUpdatingOrderId('');
    }
  };

  // ORDER CONFIRMATION VIEW
  if (orderConfirmation && !isAdmin) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 animate-fadeIn">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Store Catalog
          </button>
        )}

        <section className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-6 text-center sm:p-8 backdrop-blur-xl">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" aria-hidden="true" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Order Received</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Thank you for your order!</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300 max-w-xl mx-auto">
            Your request has been logged. Send your payment using the MTN Mobile Money details below.
            GKB will verify payment and dispatch your device immediately.
          </p>

          {orderConfirmation.whatsappUrl && (
            <div className="pt-4 flex justify-center">
              <a
                href={orderConfirmation.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all"
              >
                <MessageSquare className="h-4 w-4" />
                Notify Zumah Kelvin on WhatsApp
              </a>
            </div>
          )}
        </section>

        {/* Order Details Summary */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 backdrop-blur-xl">
          <h2 className="text-lg font-bold text-white">Order Summary</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500 text-xs font-mono uppercase">Order Reference</dt>
              <dd className="mt-1 break-all font-mono font-bold text-cyan-300">{orderConfirmation.orderId}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs font-mono uppercase">Item Ordered</dt>
              <dd className="mt-1 font-semibold text-slate-200">{orderConfirmation.productName}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs font-mono uppercase">Quantity</dt>
              <dd className="mt-1 font-semibold text-slate-200">{orderConfirmation.quantity}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs font-mono uppercase">Total Payable</dt>
              <dd className="mt-1 font-bold text-emerald-300 text-base">
                {orderConfirmation.total === null
                  ? 'GKB will confirm the amount'
                  : new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(orderConfirmation.total)}
              </dd>
            </div>
          </dl>
        </section>

        {/* MTN MoMo Card */}
        <section className="overflow-hidden rounded-2xl border border-yellow-500/30 bg-slate-900/80 backdrop-blur-xl">
          <div className="border-b border-yellow-500/20 bg-yellow-500/10 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-yellow-300">Payment Instructions</p>
            <h2 className="mt-1 text-xl font-bold text-white">Send Payment with MTN Mobile Money</h2>
            <p className="mt-1 text-xs text-slate-300">Verify the recipient name and number before confirming your PIN.</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="mx-auto max-w-md overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-mono text-slate-400">Account Type</span>
                <span className="text-xs font-bold text-yellow-400">MTN Mobile Money</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-mono text-slate-400">Account Holder</span>
                <span className="text-sm font-bold text-white">zumah kelvin🥳😍</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-mono text-slate-400">MoMo Number</span>
                <span className="text-base font-mono font-bold text-cyan-300">055 211 7787</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">Reference</span>
                <span className="text-xs font-mono font-bold text-slate-300">{orderConfirmation.orderId}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setOrderConfirmation(null)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-2.5 text-xs font-semibold text-slate-300 hover:border-cyan-400 hover:text-white transition-all cursor-pointer"
          >
            Place Another Order or View Tracking
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 animate-fadeIn">
      {/* Top Header / Back Button */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Store Catalog
            </button>
          )}
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            {isAdmin ? 'GKB Order Management Desk' : 'Order & Track Gadgets'}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            {isAdmin
              ? 'Review incoming client orders and update status transitions.'
              : 'Fill in your delivery details below to order with instant MTN Mobile Money checkout.'}
          </p>
        </div>

        {/* User state badge / Sign in prompt */}
        {user ? (
          <div className="rounded-xl border border-cyan-500/30 bg-slate-900/80 px-4 py-2 text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">Signed In</span>
            <p className="text-xs font-bold text-white">
              {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
            </p>
          </div>
        ) : (
          onOpenLogin && (
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-colors cursor-pointer"
            >
              <User className="h-3.5 w-3.5" /> Have an account? Sign In
            </button>
          )
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* ================= ORDER FORM (Non-Admin) ================= */}
      {!isAdmin && (
        <section className="rounded-3xl border border-cyan-500/30 bg-slate-900/70 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400 border border-cyan-500/20">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Place an Order</h3>
              <p className="text-xs text-slate-400">Direct pickup in Tamale/Kumasi/Accra hubs or nationwide doorstep delivery.</p>
            </div>
          </div>

          <form onSubmit={handleSubmitOrder} className="grid gap-4 sm:grid-cols-2">
            {/* Item Name */}
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300 sm:col-span-2">
              Product / Item Description *
              <input
                required
                type="text"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="e.g. HP EliteBook 840 G8 / Dell Latitude 7420 / RAM Module"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 font-sans"
              />
            </label>

            {/* Quantity */}
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Quantity *
              <input
                required
                type="number"
                min="1"
                max="999"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 font-sans"
              />
            </label>

            {/* Estimated Unit Price (if loaded) */}
            <div className="flex flex-col justify-end">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-[10px] font-mono uppercase text-slate-500">Unit Price</span>
                <p className="text-sm font-bold text-emerald-400">
                  {effectivePrice !== null
                    ? new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(effectivePrice)
                    : 'Standard Catalog Rate'}
                </p>
              </div>
            </div>

            {/* Customer Name */}
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Your Full Name *
              <input
                required
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Kwame Mensah"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 font-sans"
              />
            </label>

            {/* Customer Phone */}
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Phone / WhatsApp Number *
              <input
                required
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="e.g. 0552117787"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 font-sans"
              />
            </label>

            {/* Email (Optional for guest) */}
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Email Address (Optional)
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="customer@gmail.com"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 font-sans"
              />
            </label>

            {/* Fulfillment */}
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Delivery Preference *
              <select
                value={fulfillmentMethod}
                onChange={e => setFulfillmentMethod(e.target.value as FulfillmentMethod)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 font-sans"
              >
                <option value="delivery">Nationwide Doorstep Delivery</option>
                <option value="pickup">Direct Lab/Office Pickup</option>
              </select>
            </label>

            {/* Address */}
            {fulfillmentMethod === 'delivery' && (
              <label className="text-xs font-mono uppercase tracking-wider text-slate-300 sm:col-span-2">
                Delivery Location / Street Address *
                <textarea
                  required
                  rows={2}
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="e.g. House No. 14, Ring Road Central, Tamale or KNUST Campus Hall 4"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 font-sans"
                />
              </label>
            )}

            {formError && (
              <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 p-3 rounded-xl sm:col-span-2">
                {formError}
              </p>
            )}

            {successMessage && (
              <p role="status" className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl sm:col-span-2">
                {successMessage}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving}
              className="sm:col-span-2 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-400 to-purple-600 px-6 py-4 text-sm font-bold uppercase tracking-wider text-black shadow-lg shadow-cyan-500/25 hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Processing Order...' : 'Submit Order & View Payment Info'}
            </button>
          </form>
        </section>
      )}

      {/* ================= ORDER TRACKING LIST ================= */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xl font-bold text-white">
              {isAdmin ? 'Incoming Customer Orders' : 'My Orders & Realtime Status'}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {isAdmin
                ? `${orders.length} orders total`
                : 'Track the progress of your devices from processing to dispatch.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOrders(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-400 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400 text-center">
            Loading order records...
          </p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center space-y-2">
            <Package className="mx-auto h-8 w-8 text-slate-500" />
            <p className="text-sm font-semibold text-slate-300">
              {isAdmin ? 'No customer orders have been received yet.' : 'No active orders in your session.'}
            </p>
            <p className="text-xs text-slate-500">
              {isAdmin ? 'New orders placed online will appear here automatically.' : 'Submit an order above to start tracking it.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <article key={order.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6 backdrop-blur-xl">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-bold text-white">{order.product_name}</h4>
                      <span className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-0.5 text-xs font-mono text-slate-300">
                        Qty: {order.quantity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-mono text-slate-400">
                      <Clock3 className="mr-1 inline h-3.5 w-3.5 text-cyan-400" />
                      Ref: <span className="font-bold text-cyan-300">{order.id}</span> · Ordered {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyles[order.status] || 'border-slate-700 text-slate-300'}`}>
                    {order.status === 'delivered' || order.status === 'picked_up' ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Clock3 className="h-3.5 w-3.5" />
                    )}
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-x-6 gap-y-2 border-t border-slate-800/80 pt-4 text-xs text-slate-300 sm:grid-cols-2">
                  <p><span className="text-slate-500 font-mono">Customer:</span> {order.customer_name}</p>
                  <p><span className="text-slate-500 font-mono">Phone:</span> {order.customer_phone}</p>
                  {order.customer_email && (
                    <p><span className="text-slate-500 font-mono">Email:</span> {order.customer_email}</p>
                  )}
                  <p><span className="text-slate-500 font-mono">Method:</span> {order.fulfillment_method === 'delivery' ? 'Delivery' : 'Pickup'}</p>
                  {order.fulfillment_method === 'delivery' && (
                    <p className="sm:col-span-2"><span className="text-slate-500 font-mono">Address:</span> {order.delivery_address}</p>
                  )}
                </div>

                {/* Admin Status Transitions */}
                {isAdmin && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
                    <span className="text-xs font-mono text-slate-400">Update Status:</span>
                    <div className="flex flex-wrap gap-2">
                      {(['pending', 'processing', 'delivered', 'picked_up'] as OrderStatus[]).map(st => (
                        <button
                          key={st}
                          type="button"
                          disabled={updatingOrderId === order.id || order.status === st}
                          onClick={() => void handleStatusChange(order, st)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                            order.status === st
                              ? 'bg-cyan-500 text-black'
                              : 'bg-slate-950 border border-slate-700 text-slate-300 hover:border-cyan-400'
                          } disabled:opacity-40`}
                        >
                          {statusLabels[st]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
