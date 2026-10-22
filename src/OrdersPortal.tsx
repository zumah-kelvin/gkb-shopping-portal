import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock3, Package, RefreshCw, ShoppingBag } from 'lucide-react';
import { relaySupabase } from './supabase';

type OrderStatus = 'pending' | 'processing' | 'delivered' | 'picked_up';
type FulfillmentMethod = 'delivery' | 'pickup';

type Order = {
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

type PortalUser = {
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
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected order error occurred.';
}

export default function OrdersPortal({
  user,
  initialProductName = '',
  initialProductPrice = null,
  onOrderSubmitted
}: {
  user: PortalUser;
  initialProductName?: string;
  initialProductPrice?: number | null;
  onOrderSubmitted?: () => void;
}) {
  const isAdmin = user.role === 'admin';
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
  } | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [customerName, setCustomerName] = useState(() =>
    [user.firstName, user.lastName].filter(Boolean).join(' ')
  );
  const [customerPhone, setCustomerPhone] = useState(user.phone ?? '');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState(user.location ?? '');

  useEffect(() => {
    if (initialProductName) setProductName(initialProductName);
  }, [initialProductName]);

  const loadOrders = useCallback(async (showLoading = false) => {
    if (!relaySupabase) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable order tracking.');
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const { data, error: queryError } = await relaySupabase
        .from('gkb_orders')
        .select('id, user_id, customer_email, product_name, quantity, customer_name, customer_phone, fulfillment_method, delivery_address, status, created_at, status_updated_at')
        .order('created_at', { ascending: false });
      if (queryError) {
        setError(`Orders could not be loaded: ${queryError.message}`);
      } else {
        setOrders(data as Order[]);
        setError('');
      }
    } catch (queryError) {
      setError(`Orders could not be loaded: ${errorMessage(queryError)}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(true);
    if (!relaySupabase) return;

    const channel = relaySupabase
      .channel(`gkb-orders-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gkb_orders' }, () => {
        void loadOrders();
      })
      .subscribe();
    const refreshId = window.setInterval(() => void loadOrders(), 15000);

    return () => {
      window.clearInterval(refreshId);
      void relaySupabase?.removeChannel(channel);
    };
  }, [loadOrders, user.id]);

  const handleSubmitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');
    if (!relaySupabase) {
      setFormError('Supabase is not configured. Order submission is unavailable.');
      return;
    }
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 999) {
      setFormError('Quantity must be a whole number between 1 and 999.');
      return;
    }
    if (fulfillmentMethod === 'delivery' && !deliveryAddress.trim()) {
      setFormError('Enter a delivery address or choose pickup.');
      return;
    }

    setSaving(true);
    try {
      const orderedProduct = productName.trim();
      const { data: createdOrder, error: insertError } = await relaySupabase.from('gkb_orders').insert({
        user_id: user.id,
        customer_email: user.email,
        product_name: orderedProduct,
        quantity: parsedQuantity,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        fulfillment_method: fulfillmentMethod,
        delivery_address: fulfillmentMethod === 'delivery' ? deliveryAddress.trim() : ''
      }).select('id').single();
      if (insertError) throw insertError;

      setOrderConfirmation({
        productName: orderedProduct,
        quantity: parsedQuantity,
        total: initialProductPrice === null ? null : initialProductPrice * parsedQuantity,
        orderId: createdOrder.id
      });
      setProductName('');
      setQuantity('1');
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setFulfillmentMethod('delivery');
      setSuccessMessage('Order submitted. You can follow its status below.');
      onOrderSubmitted?.();
      await loadOrders(true);
    } catch (submitError) {
      setFormError(`Order could not be submitted: ${errorMessage(submitError)}`);
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
        .eq('id', order.id)
        .select('id')
        .single();
      if (updateError) throw updateError;
      await loadOrders();
    } catch (updateError) {
      setError(`Order status could not be updated: ${errorMessage(updateError)}`);
    } finally {
      setUpdatingOrderId('');
    }
  };

  if (orderConfirmation && !isAdmin) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 animate-fadeIn">
        <section className="rounded-2xl border border-emerald-500/30 bg-slate-900/70 p-6 text-center sm:p-8">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-300" aria-hidden="true" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Order received</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Thank you for your order!</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Your request has been saved. Use the MTN Mobile Money details below to make payment.
            GKB will confirm your order and payment before processing.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white">Order summary</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Order reference</dt>
              <dd className="mt-1 break-all font-mono text-slate-200">{orderConfirmation.orderId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Item</dt>
              <dd className="mt-1 font-semibold text-slate-200">{orderConfirmation.productName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Quantity</dt>
              <dd className="mt-1 font-semibold text-slate-200">{orderConfirmation.quantity}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Amount to pay</dt>
              <dd className="mt-1 font-bold text-emerald-300">
                {orderConfirmation.total === null
                  ? 'GKB will confirm the amount'
                  : new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(orderConfirmation.total)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="overflow-hidden rounded-2xl border border-yellow-500/30 bg-slate-900/80">
          <div className="border-b border-yellow-500/20 bg-yellow-500/5 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-yellow-300">Payment instructions</p>
            <h2 className="mt-2 text-xl font-bold text-white">Send payment with MTN Mobile Money</h2>
            <p className="mt-2 text-sm text-slate-300">Verify the recipient name and number in your MTN MoMo payment flow before confirming.</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-lg">
              <div className="flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
                <img
                  src="/mtn-momo-account-holder.png"
                  alt="Portrait of the MTN Mobile Money account holder"
                  className="h-24 w-20 shrink-0 rounded-lg border border-slate-600 object-cover object-center sm:h-28 sm:w-24"
                />
                <dl className="min-w-0 space-y-2.5">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Network</dt>
                    <dd className="text-sm font-bold text-yellow-200 sm:text-base">MTN Mobile Money</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payment number</dt>
                    <dd className="text-lg font-black tracking-wide text-white sm:text-xl">0552117787</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Account holder</dt>
                    <dd className="break-words text-sm font-bold text-white sm:text-base">zumah kelvin🥳😍</dd>
                  </div>
                </dl>
              </div>
              <div className="bg-sky-950 px-4 py-2.5 text-center text-xs font-black tracking-[0.2em] text-sky-100 sm:text-sm">
                GKB TECHNOLOGIES
              </div>
            </div>
          </div>
        </section>

        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-100">
          Do not share your Mobile Money PIN or one-time password. This page displays payment instructions only; it does not initiate or verify a payment.
        </p>
        <button
          type="button"
          onClick={() => setOrderConfirmation(null)}
          className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-5 py-3 text-sm font-bold text-black"
        >
          View My Orders
        </button>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-fadeIn">
      <header className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
          {isAdmin ? 'GKB order management' : 'Customer order tracking'}
        </p>
        <h2 className="mt-2 text-3xl font-bold text-white">{isAdmin ? 'Review Orders' : 'My Orders'}</h2>
        <p className="mt-2 text-sm text-slate-300">
          {isAdmin
            ? 'Review incoming orders and update each customer as it moves through processing, delivery, or pickup.'
            : 'Place an order and check its latest status here. Updates from GKB will appear automatically.'}
        </p>
        {!isAdmin && (
          <p className="mt-3 text-xs text-slate-400">
            Signed in as <span className="font-medium text-cyan-200">{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}</span>
            {user.phone ? ` · ${user.phone}` : ''}
            {user.location ? ` · ${user.location}` : ''}
          </p>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {!isAdmin && (
        <section className="rounded-2xl border border-purple-500/25 bg-slate-900/70 p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 text-purple-300" />
            <div>
              <h3 className="text-lg font-bold text-white">Place an order</h3>
              <p className="mt-1 text-xs text-slate-400">Tell us what you need and whether you prefer delivery or pickup.</p>
            </div>
          </div>
          <form onSubmit={handleSubmitOrder} className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-slate-300 sm:col-span-2">
              Item or product
              <input
                required
                maxLength={200}
                value={productName}
                onChange={event => setProductName(event.target.value)}
                placeholder="Product or gadget name"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-xs text-slate-300">
              Quantity
              <input
                required
                type="number"
                min="1"
                max="999"
                step="1"
                value={quantity}
                onChange={event => setQuantity(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-xs text-slate-300">
              Your name
              <input
                required
                maxLength={120}
                value={customerName}
                onChange={event => setCustomerName(event.target.value)}
                autoComplete="name"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-xs text-slate-300">
              Contact phone
              <input
                required
                type="tel"
                maxLength={30}
                value={customerPhone}
                onChange={event => setCustomerPhone(event.target.value)}
                autoComplete="tel"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-xs text-slate-300">
              Fulfillment
              <select
                value={fulfillmentMethod}
                onChange={event => setFulfillmentMethod(event.target.value as FulfillmentMethod)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="delivery">Delivery</option>
                <option value="pickup">Pickup</option>
              </select>
            </label>
            {fulfillmentMethod === 'delivery' && (
              <label className="text-xs text-slate-300 sm:col-span-2">
                Delivery address
                <textarea
                  required
                  rows={2}
                  maxLength={500}
                  value={deliveryAddress}
                  onChange={event => setDeliveryAddress(event.target.value)}
                  autoComplete="street-address"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                />
              </label>
            )}
            {formError && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{formError}</p>}
            {successMessage && <p role="status" className="text-sm text-emerald-200 sm:col-span-2">{successMessage}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-5 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:col-span-2"
            >
              {saving ? 'Placing order…' : 'Place Order'}
            </button>
          </form>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">{isAdmin ? 'Incoming orders' : 'Order status'}</h3>
            <p className="mt-1 text-xs text-slate-400">
              {isAdmin ? `${orders.length} order${orders.length === 1 ? '' : 's'} total` : 'Status changes sync automatically while this page is open.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOrders(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p role="status" className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-400">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-3 text-sm font-semibold text-slate-200">{isAdmin ? 'No orders have been submitted.' : 'You have no orders yet.'}</p>
            <p className="mt-1 text-xs text-slate-500">{isAdmin ? 'New client orders will appear here.' : 'Submit an order above to start tracking it.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <article key={order.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-bold text-white">{order.product_name}</h4>
                      <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300">Qty {order.quantity}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                      Ordered {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyles[order.status]}`}>
                    {order.status === 'delivered' || order.status === 'picked_up'
                      ? <CheckCircle className="h-3.5 w-3.5" />
                      : <Clock3 className="h-3.5 w-3.5" />}
                    {statusLabels[order.status]}
                  </span>
                </div>

                <div className="mt-4 grid gap-x-6 gap-y-2 border-t border-slate-800 pt-4 text-sm sm:grid-cols-2">
                  {isAdmin && (
                    <>
                      <p className="text-slate-300"><span className="text-slate-500">Customer:</span> {order.customer_name}</p>
                      <p className="text-slate-300"><span className="text-slate-500">Email:</span> {order.customer_email}</p>
                    </>
                  )}
                  <p className="text-slate-300"><span className="text-slate-500">Phone:</span> {order.customer_phone}</p>
                  <p className="text-slate-300"><span className="text-slate-500">Fulfillment:</span> {order.fulfillment_method === 'delivery' ? 'Delivery' : 'Pickup'}</p>
                  {order.fulfillment_method === 'delivery' && (
                    <p className="text-slate-300 sm:col-span-2"><span className="text-slate-500">Address:</span> {order.delivery_address}</p>
                  )}
                </div>

                {isAdmin && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                    <p className="text-xs text-slate-500">Last updated {formatDate(order.status_updated_at)}</p>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      Update status
                      <select
                        aria-label={`Update order status for ${order.product_name}`}
                        value={order.status}
                        disabled={updatingOrderId === order.id}
                        onChange={event => {
                          const nextStatus = event.target.value;
                          if (nextStatus === 'pending' || nextStatus === 'processing' || nextStatus === 'delivered' || nextStatus === 'picked_up') {
                            void handleStatusChange(order, nextStatus);
                          }
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400 disabled:opacity-50"
                      >
                        {(['pending', 'processing', order.fulfillment_method === 'delivery' ? 'delivered' : 'picked_up'] as OrderStatus[]).map(status => (
                          <option key={status} value={status}>{statusLabels[status]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
