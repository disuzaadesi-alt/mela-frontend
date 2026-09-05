import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ShoppingBag, Search, Heart, User, X, Plus, Minus, Trash2,
  ChevronRight, ChevronLeft, Package, CheckCircle2, Star, LogOut,
  LayoutDashboard, Pencil, SlidersHorizontal, ArrowLeft, MapPin,
  CreditCard, Truck, Home as HomeIcon, ShieldCheck, Sparkles, WifiOff
} from "lucide-react";

// ---- Backend connection ----
// After you deploy the backend (see README.md), replace this with your
// real server URL, e.g. "https://mela-backend.onrender.com"
const API_BASE_URL = "https://mela-backend-rg3y.onrender.com";

async function apiFetch(path, { token, ...options } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const THEME = {
  ink: "#15171C",
  paper: "#ECE9E2",
  paperDark: "#DFDBD1",
  cream: "#F6F4EF",
  gold: "#B78A3D",
  goldDark: "#8F6C2C",
  green: "#2B5D45",
  wine: "#7A2E3B",
  gray: "#6B6B66",
  line: "#D6D2C6",
};

const CATEGORIES = [
  { name: "Fashion", icon: "\u{1F457}" },
  { name: "Electronics", icon: "\u{1F50C}" },
  { name: "Home & Kitchen", icon: "\u{1F3E1}" },
  { name: "Beauty", icon: "\u{1F338}" },
  { name: "Grocery", icon: "\u{1F33E}" },
];

const RAW = {
  Fashion: [
    ["Handloom Cotton Kurta", 899, 1499, "kurta1"],
    ["Slim Fit Denim Jacket", 1799, 2999, "jacket1"],
    ["Banarasi Silk Saree", 2999, 4999, "saree1"],
    ["Everyday Canvas Sneakers", 1299, 1999, "sneak1"],
    ["Linen Formal Shirt", 999, 1599, "shirt1"],
  ],
  Electronics: [
    ["Wireless Earbuds Pro", 1999, 3499, "earbuds1"],
    ["Smart LED TV 43-inch", 21999, 27999, "tv1"],
    ["10000mAh Power Bank", 799, 1299, "power1"],
    ["Smartwatch Series X", 2499, 3999, "watch1"],
    ["Bluetooth Speaker Mini", 999, 1799, "speaker1"],
  ],
  "Home & Kitchen": [
    ["Non-Stick Cookware Set", 1599, 2499, "cook1"],
    ["Cotton Bedsheet Set (King)", 899, 1499, "bedsheet1"],
    ["Air Fryer 4L", 3499, 4999, "fryer1"],
    ["Ceramic Dinner Set (16pc)", 1899, 2799, "dinner1"],
    ["Memory Foam Pillow (Pair)", 799, 1299, "pillow1"],
  ],
  Beauty: [
    ["Vitamin C Face Serum", 449, 699, "serum1"],
    ["Matte Lipstick Combo", 599, 999, "lip1"],
    ["Herbal Hair Oil 200ml", 249, 399, "oil1"],
    ["Sunscreen SPF 50", 349, 549, "sun1"],
    ["Perfume Gift Set", 1299, 1999, "perfume1"],
  ],
  Grocery: [
    ["Basmati Rice 5kg", 549, 699, "rice1"],
    ["Cold Pressed Groundnut Oil 1L", 289, 349, "oilg1"],
    ["Assorted Dry Fruits Box", 799, 1099, "dry1"],
    ["Organic Honey 500g", 299, 399, "honey1"],
    ["Masala Chai Pack", 199, 279, "chai1"],
  ],
};

const PRODUCTS = Object.entries(RAW).flatMap(([cat, items]) =>
  items.map(([name, price, mrp, seed], i) => ({
    id: `${cat}-${i}`.replace(/\s/g, ""),
    name,
    category: cat,
    price,
    mrp,
    rating: (3.8 + ((i * 7) % 12) / 10).toFixed(1),
    reviews: 40 + i * 63 + cat.length * 5,
    seed,
    stock: 8 + i * 3,
    desc: `${name} — a MELA pick chosen for everyday quality and honest pricing. Carefully sourced, quality-checked, and ready to ship.`,
  }))
);

const inr = (n) => "\u20B9" + Math.round(n).toLocaleString("en-IN");
const img = (seed, w = 500, h = 650) => {
  if (typeof seed === "string" && seed.startsWith("http")) return seed;
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
};
const discountPct = (price, mrp) => Math.round(((mrp - price) / mrp) * 100);

const STAGES = ["Placed", "Confirmed", "Shipped", "Out for delivery", "Delivered"];

export default function Mela() {
  const [page, setPage] = useState("home");
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeProductId, setActiveProductId] = useState(null);
  const [query, setQuery] = useState("");
  const readStorage = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const [cart, setCart] = useState(() => readStorage("mela_cart", {}));
  const [wishlist, setWishlist] = useState(() => readStorage("mela_wishlist", {}));
  const [user, setUser] = useState(() => readStorage("mela_user", null));
  const [orders, setOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [address, setAddress] = useState({ name: "", phone: "", line1: "", city: "", pincode: "" });
  const [payment, setPayment] = useState("upi");
  const [toast, setToast] = useState(null);
  const [products, setProducts] = useState(PRODUCTS);
  const [adminTab, setAdminTab] = useState("products");
  const [editingProduct, setEditingProduct] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("mela_token") || null;
    } catch {
      return null;
    }
  });
  const [backendConnected, setBackendConnected] = useState(null); // null=checking, true, false
  const [authError, setAuthError] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [adminOrders, setAdminOrders] = useState([]);

  const toStageIndex = (s) => STAGES.indexOf(
    { PLACED: "Placed", CONFIRMED: "Confirmed", SHIPPED: "Shipped", OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered" }[s]
  );

  const normalizeOrder = (o) => ({
    ...o,
    date: new Date(o.createdAt),
    stage: toStageIndex(o.stage),
    address: { name: o.addressName, phone: o.addressPhone, line1: o.addressLine1, city: o.addressCity, pincode: o.addressPincode },
    items: o.items.map((it) => ({ ...it, seed: it.product?.imageSeed || "package", category: it.product?.category })),
  });

  const refreshAdminOrders = useCallback(
    (authToken) => {
      if (!backendConnected) return;
      apiFetch("/api/orders/all", { token: authToken || token })
        .then((data) => setAdminOrders(data.map(normalizeOrder)))
        .catch(() => {});
    },
    [backendConnected, token]
  );

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  // On load: try the real backend. If it isn't reachable yet (not deployed,
  // or API_BASE_URL not updated), fall back to the built-in demo data so the
  // preview still works.
  useEffect(() => {
    apiFetch("/api/products")
      .then((data) => {
        setProducts(
          data.length
            ? data.map((p) => ({ ...p, seed: p.imageSeed }))
            : PRODUCTS
        );
        setBackendConnected(true);
      })
      .catch(() => setBackendConnected(false));
    loadRazorpayScript();
  }, []);

  useEffect(() => {
    if (page === "admin" && user?.isAdmin && backendConnected) {
      refreshAdminOrders(token);
    }
  }, [page, user, backendConnected]);

  // Persist session, cart and wishlist to localStorage so returning to the
  // site (reopening the browser, tapping back, etc.) doesn't log the user
  // out or clear their cart. Safe now that this runs as a real deployed
  // site rather than inside Claude's sandboxed artifact preview.
  useEffect(() => {
    try {
      if (token) localStorage.setItem("mela_token", token);
      else localStorage.removeItem("mela_token");
    } catch {}
  }, [token]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem("mela_user", JSON.stringify(user));
      else localStorage.removeItem("mela_user");
    } catch {}
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem("mela_cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem("mela_wishlist", JSON.stringify(wishlist));
    } catch {}
  }, [wishlist]);

  // If a session was restored from a previous visit, pull the user's orders
  // as soon as the backend connection is confirmed.
  useEffect(() => {
    if (backendConnected && token && user && !user.isAdmin) {
      refreshOrders(token);
    }
  }, [backendConnected]);

  const refreshOrders = useCallback(
    (authToken) => {
      if (!backendConnected) return;
      apiFetch("/api/orders", { token: authToken || token })
        .then((data) => setOrders(data.map(normalizeOrder)))
        .catch(() => {});
    },
    [backendConnected, token]
  );

  const goto = (p, extra = {}) => {
    window.scrollTo?.({ top: 0 });
    setPage(p);
    if (extra.category !== undefined) setActiveCategory(extra.category);
    if (extra.productId !== undefined) setActiveProductId(extra.productId);
    if (extra.orderId !== undefined) setActiveOrderId(extra.orderId);
  };

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ ...products.find((p) => p.id === id), qty }))
    .filter((i) => i.id);
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartMrpTotal = cartItems.reduce((sum, i) => sum + i.mrp * i.qty, 0);
  const shipping = cartTotal > 999 || cartTotal === 0 ? 0 : 79;

  const addToCart = (id, qty = 1) => {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + qty }));
    showToast("Added to bag");
  };
  const setQty = (id, qty) => {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  };
  const toggleWishlist = (id) => {
    setWishlist((w) => {
      const next = { ...w };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [query, products]);

  const placeOrder = async () => {
    // Fallback demo path if the backend isn't connected yet
    if (!backendConnected) {
      const id = "MELA" + Math.floor(100000 + Math.random() * 900000);
      const newOrder = { id, date: new Date(), items: cartItems, total: cartTotal + shipping, address, payment, stage: 0 };
      setOrders((o) => [newOrder, ...o]);
      setCart({});
      goto("confirmation", { orderId: id });
      return;
    }

    if (!token) {
      showToast("Please log in to place an order");
      setShowLogin(true);
      return;
    }

    setPlacingOrder(true);
    try {
      const body = {
        items: cartItems.map((i) => ({ productId: i.id, qty: i.qty })),
        address,
        paymentMethod: payment,
      };
      const result = await apiFetch("/api/orders", { method: "POST", token, body: JSON.stringify(body) });

      if (payment === "cod") {
        setCart({});
        refreshOrders();
        goto("confirmation", { orderId: result.order.id });
        setPlacingOrder(false);
        return;
      }

      // Online payment: open Razorpay's real checkout popup (test mode)
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        showToast("Could not load payment gateway. Check your connection.");
        setPlacingOrder(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: result.razorpayKeyId,
        amount: result.razorpayOrder.amount,
        currency: result.razorpayOrder.currency,
        name: "MELA",
        description: `Order ${result.order.id}`,
        order_id: result.razorpayOrder.id,
        prefill: { name: address.name, contact: address.phone },
        theme: { color: THEME.gold },
        handler: async (response) => {
          try {
            await apiFetch("/api/payment/verify", {
              method: "POST",
              token,
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            setCart({});
            refreshOrders();
            goto("confirmation", { orderId: result.order.id });
          } catch (err) {
            showToast(err.message);
          }
        },
        modal: { ondismiss: () => setPlacingOrder(false) },
      });
      rzp.open();
    } catch (err) {
      showToast(err.message);
    }
    setPlacingOrder(false);
  };

  const advanceOrderStage = async (id) => {
    if (!backendConnected) {
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, stage: Math.min(o.stage + 1, STAGES.length - 1) } : o)));
      return;
    }
    try {
      await apiFetch(`/api/orders/${id}/stage`, { method: "PATCH", token });
      refreshOrders();
      refreshAdminOrders();
    } catch (err) {
      showToast(err.message);
    }
  };

  const saveProduct = async (p) => {
    if (!backendConnected) {
      setProducts((ps) => {
        const exists = ps.some((x) => x.id === p.id);
        return exists ? ps.map((x) => (x.id === p.id ? p : x)) : [p, ...ps];
      });
      setEditingProduct(null);
      showToast(p.__isNew ? "Product added" : "Product updated");
      return;
    }
    try {
      const payload = { name: p.name, category: p.category, price: p.price, mrp: p.mrp, stock: p.stock, imageSeed: p.seed || p.imageSeed, description: p.desc || p.description };
      if (p.__isNew) {
        const created = await apiFetch("/api/products", { method: "POST", token, body: JSON.stringify(payload) });
        setProducts((ps) => [{ ...created, seed: created.imageSeed }, ...ps]);
      } else {
        const updated = await apiFetch(`/api/products/${p.id}`, { method: "PUT", token, body: JSON.stringify(payload) });
        setProducts((ps) => ps.map((x) => (x.id === p.id ? { ...updated, seed: updated.imageSeed } : x)));
      }
      setEditingProduct(null);
      showToast(p.__isNew ? "Product added" : "Product updated");
    } catch (err) {
      showToast(err.message);
    }
  };
  const deleteProduct = async (id) => {
    if (!backendConnected) {
      setProducts((ps) => ps.filter((p) => p.id !== id));
      showToast("Product removed");
      return;
    }
    try {
      await apiFetch(`/api/products/${id}`, { method: "DELETE", token });
      setProducts((ps) => ps.filter((p) => p.id !== id));
      showToast("Product removed");
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div style={{ background: THEME.paper, color: THEME.ink, minHeight: "100vh" }} className="font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        .font-serif-display { font-family: 'Fraunces', serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
        * { box-sizing: border-box; }
        ::selection { background: ${THEME.gold}; color: white; }
      `}</style>

      <Header
        cartCount={cartCount}
        wishlistCount={Object.keys(wishlist).length}
        user={user}
        query={query}
        setQuery={setQuery}
        goto={goto}
        setShowLogin={setShowLogin}
        setUser={(u) => { setUser(u); if (!u) { setToken(null); setOrders([]); } }}
      />

      {toast && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded text-sm shadow-lg"
          style={{ background: THEME.ink, color: THEME.cream }}
        >
          {toast}
        </div>
      )}

      {showLogin && (
        <LoginModal
          onClose={() => { setShowLogin(false); setAuthError(""); }}
          backendConnected={backendConnected}
          authError={authError}
          onDemoLogin={(u) => {
            setUser(u);
            setShowLogin(false);
            showToast(`Welcome, ${u.name}`);
            if (u.isAdmin) goto("admin");
          }}
          onRealAuth={async ({ mode, name, email, password }) => {
            setAuthError("");
            try {
              const data = await apiFetch(`/api/auth/${mode}`, {
                method: "POST",
                body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
              });
              setToken(data.token);
              setUser(data.user);
              setShowLogin(false);
              showToast(`Welcome, ${data.user.name}`);
              refreshOrders(data.token);
              if (data.user.isAdmin) goto("admin");
            } catch (err) {
              setAuthError(err.message);
            }
          }}
        />
      )}

      {backendConnected === false && (
        <div className="flex items-center justify-center gap-2 text-xs py-2 px-4" style={{ background: "#FBEAEA", color: THEME.wine }}>
          <WifiOff size={13} /> Backend not connected — running on demo data. Deploy the backend and update API_BASE_URL to go live.
        </div>
      )}

      <main>
        {query.trim() ? (
          <SearchResults results={searchResults} goto={goto} onAdd={addToCart} wishlist={wishlist} onWish={toggleWishlist} />
        ) : page === "home" ? (
          <HomePage products={products} goto={goto} onAdd={addToCart} wishlist={wishlist} onWish={toggleWishlist} />
        ) : page === "category" ? (
          <CategoryPage
            category={activeCategory}
            products={products.filter((p) => p.category === activeCategory)}
            goto={goto}
            onAdd={addToCart}
            wishlist={wishlist}
            onWish={toggleWishlist}
          />
        ) : page === "product" ? (
          <ProductPage
            product={products.find((p) => p.id === activeProductId)}
            goto={goto}
            onAdd={addToCart}
            wishlist={wishlist}
            onWish={toggleWishlist}
          />
        ) : page === "cart" ? (
          <CartPage
            items={cartItems}
            setQty={setQty}
            total={cartTotal}
            mrpTotal={cartMrpTotal}
            shipping={shipping}
            goto={goto}
          />
        ) : page === "checkout" ? (
          <CheckoutPage
            step={checkoutStep}
            setStep={setCheckoutStep}
            address={address}
            setAddress={setAddress}
            payment={payment}
            setPayment={setPayment}
            items={cartItems}
            total={cartTotal}
            shipping={shipping}
            onPlace={placeOrder}
            placing={placingOrder}
            backendConnected={backendConnected}
            user={user}
            goto={goto}
          />
        ) : page === "confirmation" ? (
          <ConfirmationPage order={orders.find((o) => o.id === activeOrderId)} goto={goto} />
        ) : page === "orders" ? (
          <OrdersPage orders={orders} goto={goto} onAdvance={advanceOrderStage} />
        ) : page === "wishlist" ? (
          <WishlistPage
            products={products.filter((p) => wishlist[p.id])}
            goto={goto}
            onAdd={addToCart}
            onWish={toggleWishlist}
          />
        ) : page === "admin" ? (
          user?.isAdmin ? (
            <AdminPanel
              products={products}
              orders={backendConnected ? adminOrders : orders}
              tab={adminTab}
              setTab={setAdminTab}
              editingProduct={editingProduct}
              setEditingProduct={setEditingProduct}
              onSave={saveProduct}
              onDelete={deleteProduct}
              backendConnected={backendConnected}
            />
          ) : (
            <AdminLocked setShowLogin={setShowLogin} />
          )
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

/* ---------------- Header ---------------- */
function Header({ cartCount, wishlistCount, user, query, setQuery, goto, setShowLogin, setUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header style={{ background: THEME.ink, color: THEME.cream }} className="sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 h-16">
          <button onClick={() => goto("home")} className="font-serif-display text-2xl tracking-tight shrink-0" style={{ letterSpacing: "-0.02em" }}>
            MELA
          </button>
          <div className="hidden md:flex items-center flex-1 max-w-md">
            <div className="flex items-center w-full rounded-full px-3 py-1.5" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Search size={16} className="shrink-0" style={{ color: THEME.gold }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search MELA"
                className="bg-transparent outline-none text-sm ml-2 w-full placeholder-white/50"
                style={{ color: THEME.cream }}
              />
            </div>
          </div>
          <div className="flex-1 md:hidden" />
          <nav className="hidden md:flex items-center gap-5 text-sm shrink-0">
            <button onClick={() => goto("wishlist")} className="flex items-center gap-1.5 hover:opacity-80">
              <Heart size={18} /> {wishlistCount > 0 && <span>{wishlistCount}</span>}
            </button>
            <button onClick={() => goto("orders")} className="flex items-center gap-1.5 hover:opacity-80">
              <Package size={18} /> Orders
            </button>
            <button
              onClick={() => (user ? goto("orders") : setShowLogin(true))}
              className="flex items-center gap-1.5 hover:opacity-80"
            >
              <User size={18} /> {user ? user.name.split(" ")[0] : "Login"}
            </button>
            {user?.isAdmin && (
              <button onClick={() => goto("admin")} className="flex items-center gap-1.5 hover:opacity-80">
                <LayoutDashboard size={18} /> Admin
              </button>
            )}
            {user && (
              <button onClick={() => setUser(null)} title="Log out" className="hover:opacity-80">
                <LogOut size={17} />
              </button>
            )}
            <button onClick={() => goto("cart")} className="flex items-center gap-1.5 relative hover:opacity-80">
              <ShoppingBag size={18} />
              {cartCount > 0 && (
                <span
                  className="absolute -top-2 -right-2 text-[10px] rounded-full w-4 h-4 flex items-center justify-center"
                  style={{ background: THEME.gold, color: THEME.ink }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </nav>
          <button className="md:hidden" onClick={() => goto("cart")}>
            <div className="relative">
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span
                  className="absolute -top-2 -right-2 text-[10px] rounded-full w-4 h-4 flex items-center justify-center"
                  style={{ background: THEME.gold, color: THEME.ink }}
                >
                  {cartCount}
                </span>
              )}
            </div>
          </button>
          <button className="md:hidden" onClick={() => setMenuOpen((v) => !v)}>
            <SlidersHorizontal size={20} />
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden pb-3 flex flex-col gap-3 text-sm">
            <div className="flex items-center rounded-full px-3 py-2" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Search size={16} style={{ color: THEME.gold }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search MELA"
                className="bg-transparent outline-none text-sm ml-2 w-full placeholder-white/50"
                style={{ color: THEME.cream }}
              />
            </div>
            <button onClick={() => { goto("wishlist"); setMenuOpen(false); }} className="flex items-center gap-2 text-left">
              <Heart size={16} /> Wishlist ({wishlistCount})
            </button>
            <button onClick={() => { goto("orders"); setMenuOpen(false); }} className="flex items-center gap-2 text-left">
              <Package size={16} /> Orders
            </button>
            <button
              onClick={() => { user ? goto("orders") : setShowLogin(true); setMenuOpen(false); }}
              className="flex items-center gap-2 text-left"
            >
              <User size={16} /> {user ? user.name : "Login / Sign up"}
            </button>
            {user?.isAdmin && (
              <button onClick={() => { goto("admin"); setMenuOpen(false); }} className="flex items-center gap-2 text-left">
                <LayoutDashboard size={16} /> Admin panel
              </button>
            )}
            {user && (
              <button onClick={() => { setUser(null); setMenuOpen(false); }} className="flex items-center gap-2 text-left">
                <LogOut size={16} /> Log out
              </button>
            )}
          </div>
        )}
      </div>
      <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-5 overflow-x-auto text-sm py-2.5 no-scrollbar">
          {CATEGORIES.map((c) => (
            <button
              key={c.name}
              onClick={() => goto("category", { category: c.name })}
              className="flex items-center gap-1.5 whitespace-nowrap hover:opacity-80"
            >
              <span>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

/* ---------------- Home ---------------- */
function HomePage({ products, goto, onAdd, wishlist, onWish }) {
  const picks = products.filter((_, i) => i % 3 === 0).slice(0, 8);
  return (
    <div>
      <section style={{ background: THEME.ink, color: THEME.cream }} className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid md:grid-cols-5 gap-8 items-center">
          <div className="md:col-span-3">
            <p className="text-sm mb-4 flex items-center gap-2" style={{ color: THEME.gold }}>
              <Sparkles size={15} /> Everything, under one roof
            </p>
            <h1 className="font-serif-display leading-[0.95] text-5xl sm:text-6xl md:text-7xl mb-6">
              One bazaar.
              <br />
              Every corner of
              <br />
              your day.
            </h1>
            <p className="max-w-md mb-8" style={{ color: "rgba(255,255,255,0.7)" }}>
              Fashion, electronics, home essentials, beauty and groceries —
              handpicked and fairly priced, delivered to your door.
            </p>
            <button
              onClick={() => goto("category", { category: "Fashion" })}
              className="px-6 py-3 rounded-full font-medium"
              style={{ background: THEME.gold, color: THEME.ink }}
            >
              Start exploring
            </button>
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            <img src={img("hero1", 300, 400)} className="rounded-lg object-cover w-full h-full" style={{ gridRow: "span 2" }} alt="" />
            <img src={img("hero2", 300, 190)} className="rounded-lg object-cover w-full h-full" alt="" />
            <img src={img("hero3", 300, 190)} className="rounded-lg object-cover w-full h-full" alt="" />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          {CATEGORIES.map((c, i) => (
            <button
              key={c.name}
              onClick={() => goto("category", { category: c.name })}
              className="rounded-xl overflow-hidden text-left group"
              style={{ background: THEME.cream, border: `1px solid ${THEME.line}` }}
            >
              <img src={img(RAW[c.name][0][3], 300, 220)} className="w-full h-28 sm:h-32 object-cover" alt="" />
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-sm">{c.name}</span>
                <ChevronRight size={16} style={{ color: THEME.gold }} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-16">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-serif-display text-2xl sm:text-3xl">Today's picks</h2>
          <span className="text-sm" style={{ color: THEME.gray }}>{picks.length} items</span>
        </div>
        <ProductGrid products={picks} goto={goto} onAdd={onAdd} wishlist={wishlist} onWish={onWish} />
      </section>
    </div>
  );
}

/* ---------------- Category / Search / Wishlist listing pages ---------------- */
function CategoryPage({ category, products, goto, onAdd, wishlist, onWish }) {
  const [sort, setSort] = useState("popular");
  const sorted = useMemo(() => {
    const arr = [...products];
    if (sort === "priceLow") arr.sort((a, b) => a.price - b.price);
    if (sort === "priceHigh") arr.sort((a, b) => b.price - a.price);
    if (sort === "rating") arr.sort((a, b) => b.rating - a.rating);
    return arr;
  }, [products, sort]);
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => goto("home")} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: THEME.gray }}>
        <ArrowLeft size={15} /> Back
      </button>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-serif-display text-3xl sm:text-4xl">{category}</h1>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="text-sm rounded-full px-3 py-2 outline-none"
          style={{ background: THEME.cream, border: `1px solid ${THEME.line}` }}
        >
          <option value="popular">Popular</option>
          <option value="priceLow">Price: Low to High</option>
          <option value="priceHigh">Price: High to Low</option>
          <option value="rating">Rating</option>
        </select>
      </div>
      <ProductGrid products={sorted} goto={goto} onAdd={onAdd} wishlist={wishlist} onWish={onWish} />
    </div>
  );
}

function SearchResults({ results, goto, onAdd, wishlist, onWish }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-serif-display text-2xl sm:text-3xl mb-6">
        {results.length} result{results.length !== 1 ? "s" : ""}
      </h1>
      {results.length === 0 ? (
        <EmptyState text="No products match your search. Try a different word." />
      ) : (
        <ProductGrid products={results} goto={goto} onAdd={onAdd} wishlist={wishlist} onWish={onWish} />
      )}
    </div>
  );
}

function WishlistPage({ products, goto, onAdd, onWish }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-serif-display text-3xl sm:text-4xl mb-6">Your wishlist</h1>
      {products.length === 0 ? (
        <EmptyState text="Nothing saved yet. Tap the heart on any product to keep it here." />
      ) : (
        <ProductGrid products={products} goto={goto} onAdd={onAdd} wishlist={Object.fromEntries(products.map((p) => [p.id, true]))} onWish={onWish} />
      )}
    </div>
  );
}

function ProductGrid({ products, goto, onAdd, wishlist, onWish }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} goto={goto} onAdd={onAdd} isWished={!!wishlist[p.id]} onWish={onWish} />
      ))}
    </div>
  );
}

function ProductCard({ p, goto, onAdd, isWished, onWish }) {
  return (
    <div className="group">
      <div className="relative rounded-lg overflow-hidden mb-2.5" style={{ background: THEME.cream }}>
        <button onClick={() => goto("product", { productId: p.id })} className="block w-full">
          <img src={img(p.seed)} alt={p.name} className="w-full aspect-[4/5] object-cover" />
        </button>
        <span
          className="absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: THEME.wine, color: "white" }}
        >
          {discountPct(p.price, p.mrp)}% off
        </span>
        <button
          onClick={() => onWish(p.id)}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.9)" }}
        >
          <Heart size={14} fill={isWished ? THEME.wine : "none"} color={isWished ? THEME.wine : THEME.ink} />
        </button>
      </div>
      <button onClick={() => goto("product", { productId: p.id })} className="text-left block w-full">
        <p className="text-sm font-medium leading-snug line-clamp-2">{p.name}</p>
        <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: THEME.gray }}>
          <Star size={12} fill={THEME.gold} color={THEME.gold} /> {p.rating} ({p.reviews})
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-semibold">{inr(p.price)}</span>
          <span className="text-xs line-through" style={{ color: THEME.gray }}>{inr(p.mrp)}</span>
        </div>
      </button>
      <button
        onClick={() => onAdd(p.id)}
        className="mt-2 w-full text-xs font-medium py-2 rounded-full"
        style={{ border: `1px solid ${THEME.ink}` }}
      >
        Add to bag
      </button>
    </div>
  );
}

/* ---------------- Product detail ---------------- */
function ProductPage({ product, goto, onAdd, wishlist, onWish }) {
  const [qty, setQty] = useState(1);
  if (!product) return <EmptyState text="Product not found." />;
  const isWished = !!wishlist[product.id];
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => goto("category", { category: product.category })} className="flex items-center gap-1.5 text-sm mb-6" style={{ color: THEME.gray }}>
        <ArrowLeft size={15} /> Back to {product.category}
      </button>
      <div className="grid md:grid-cols-2 gap-10">
        <img src={img(product.seed, 700, 900)} alt={product.name} className="w-full rounded-xl object-cover" style={{ background: THEME.cream }} />
        <div>
          <p className="text-sm mb-2" style={{ color: THEME.gold }}>{product.category}</p>
          <h1 className="font-serif-display text-3xl sm:text-4xl mb-3">{product.name}</h1>
          <div className="flex items-center gap-1.5 text-sm mb-4" style={{ color: THEME.gray }}>
            <Star size={14} fill={THEME.gold} color={THEME.gold} /> {product.rating} rating · {product.reviews} reviews
          </div>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-2xl font-semibold">{inr(product.price)}</span>
            <span className="text-base line-through" style={{ color: THEME.gray }}>{inr(product.mrp)}</span>
            <span className="text-sm font-medium" style={{ color: THEME.green }}>{discountPct(product.price, product.mrp)}% off</span>
          </div>
          <p className="text-sm mb-6" style={{ color: THEME.gray }}>Inclusive of all taxes</p>
          <p className="mb-6 text-sm leading-relaxed" style={{ color: THEME.ink }}>{product.desc}</p>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center rounded-full" style={{ border: `1px solid ${THEME.line}` }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 flex items-center justify-center"><Minus size={14} /></button>
              <span className="w-8 text-center text-sm">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} className="w-9 h-9 flex items-center justify-center"><Plus size={14} /></button>
            </div>
            <span className="text-xs" style={{ color: THEME.gray }}>{product.stock} in stock</span>
          </div>

          <div className="flex gap-3 mb-8">
            <button
              onClick={() => onAdd(product.id, qty)}
              className="flex-1 py-3 rounded-full font-medium"
              style={{ background: THEME.ink, color: THEME.cream }}
            >
              Add to bag
            </button>
            <button
              onClick={() => onWish(product.id)}
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ border: `1px solid ${THEME.line}` }}
            >
              <Heart size={18} fill={isWished ? THEME.wine : "none"} color={isWished ? THEME.wine : THEME.ink} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: THEME.cream }}>
              <Truck size={16} style={{ color: THEME.gold }} /> Free delivery over {inr(999)}
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: THEME.cream }}>
              <ShieldCheck size={16} style={{ color: THEME.gold }} /> 7-day easy returns
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Cart ---------------- */
function CartPage({ items, setQty, total, mrpTotal, shipping, goto }) {
  if (items.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <EmptyState text="Your bag is empty." action={{ label: "Continue shopping", onClick: () => goto("home") }} />
      </div>
    );
  }
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-serif-display text-3xl sm:text-4xl mb-6">Your bag</h1>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 flex flex-col gap-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 p-3 rounded-lg" style={{ background: THEME.cream }}>
              <img src={img(item.seed, 160, 200)} className="w-20 h-24 object-cover rounded" alt="" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs mb-2" style={{ color: THEME.gray }}>{item.category}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center rounded-full" style={{ border: `1px solid ${THEME.line}` }}>
                    <button onClick={() => setQty(item.id, item.qty - 1)} className="w-7 h-7 flex items-center justify-center"><Minus size={12} /></button>
                    <span className="w-6 text-center text-xs">{item.qty}</span>
                    <button onClick={() => setQty(item.id, item.qty + 1)} className="w-7 h-7 flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                  <span className="font-semibold text-sm">{inr(item.price * item.qty)}</span>
                </div>
              </div>
              <button onClick={() => setQty(item.id, 0)} className="self-start" style={{ color: THEME.gray }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="rounded-lg p-5 h-fit" style={{ background: THEME.cream }}>
          <h2 className="font-medium mb-4">Order summary</h2>
          <div className="flex justify-between text-sm mb-2"><span style={{ color: THEME.gray }}>MRP total</span><span className="line-through">{inr(mrpTotal)}</span></div>
          <div className="flex justify-between text-sm mb-2"><span style={{ color: THEME.gray }}>Discount</span><span style={{ color: THEME.green }}>-{inr(mrpTotal - total)}</span></div>
          <div className="flex justify-between text-sm mb-3"><span style={{ color: THEME.gray }}>Delivery</span><span>{shipping === 0 ? "Free" : inr(shipping)}</span></div>
          <div className="h-px my-3" style={{ background: THEME.line }} />
          <div className="flex justify-between font-semibold mb-5"><span>Total</span><span>{inr(total + shipping)}</span></div>
          <button
            onClick={() => goto("checkout")}
            className="w-full py-3 rounded-full font-medium"
            style={{ background: THEME.ink, color: THEME.cream }}
          >
            Proceed to checkout
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Checkout ---------------- */
function CheckoutPage({ step, setStep, address, setAddress, payment, setPayment, items, total, shipping, onPlace, placing, backendConnected, user, goto }) {
  const steps = ["Address", "Payment", "Review"];
  const valid = address.name && address.phone && address.line1 && address.city && address.pincode;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => goto("cart")} className="flex items-center gap-1.5 text-sm mb-6" style={{ color: THEME.gray }}>
        <ArrowLeft size={15} /> Back to bag
      </button>
      <div className="flex items-center gap-3 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
              style={{
                background: i <= step ? THEME.ink : THEME.cream,
                color: i <= step ? THEME.cream : THEME.gray,
                border: `1px solid ${i <= step ? THEME.ink : THEME.line}`,
              }}
            >
              {i + 1}
            </div>
            <span className="text-sm hidden sm:inline" style={{ color: i <= step ? THEME.ink : THEME.gray }}>{s}</span>
            {i < steps.length - 1 && <div className="w-8 h-px" style={{ background: THEME.line }} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="max-w-md">
          <h2 className="font-serif-display text-2xl mb-4">Delivery address</h2>
          <div className="flex flex-col gap-3">
            <Input label="Full name" value={address.name} onChange={(v) => setAddress({ ...address, name: v })} />
            <Input label="Phone number" value={address.phone} onChange={(v) => setAddress({ ...address, phone: v })} />
            <Input label="Address line" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} />
            <div className="flex gap-3">
              <Input label="City" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} />
              <Input label="Pincode" value={address.pincode} onChange={(v) => setAddress({ ...address, pincode: v })} />
            </div>
          </div>
          <button
            disabled={!valid}
            onClick={() => setStep(1)}
            className="mt-6 px-6 py-3 rounded-full font-medium disabled:opacity-40"
            style={{ background: THEME.ink, color: THEME.cream }}
          >
            Continue to payment
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="max-w-md">
          <h2 className="font-serif-display text-2xl mb-4">Payment method</h2>
          <div className="flex flex-col gap-2">
            {[
              { id: "upi", label: "UPI", icon: <CreditCard size={16} /> },
              { id: "card", label: "Credit / Debit Card", icon: <CreditCard size={16} /> },
              { id: "cod", label: "Cash on Delivery", icon: <Truck size={16} /> },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPayment(opt.id)}
                className="flex items-center gap-3 p-3 rounded-lg text-sm text-left"
                style={{ border: `1px solid ${payment === opt.id ? THEME.ink : THEME.line}`, background: payment === opt.id ? THEME.cream : "transparent" }}
              >
                {opt.icon} {opt.label}
                {payment === opt.id && <CheckCircle2 size={16} className="ml-auto" style={{ color: THEME.green }} />}
              </button>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: THEME.gray }}>
            {backendConnected
              ? (payment === "cod" ? "Cash on delivery — pay when your order arrives." : "Razorpay test mode — use card 4111 1111 1111 1111, any future date/CVV.")
              : "This is a demo checkout — no real payment is processed."}
          </p>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep(0)} className="px-6 py-3 rounded-full font-medium" style={{ border: `1px solid ${THEME.line}` }}>Back</button>
            <button onClick={() => setStep(2)} className="px-6 py-3 rounded-full font-medium" style={{ background: THEME.ink, color: THEME.cream }}>Review order</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-md">
          <h2 className="font-serif-display text-2xl mb-4">Review & place order</h2>
          <div className="rounded-lg p-4 mb-4 text-sm" style={{ background: THEME.cream }}>
            <p className="font-medium mb-1">Deliver to</p>
            <p style={{ color: THEME.gray }}>{address.name}, {address.line1}, {address.city} - {address.pincode}</p>
            <p style={{ color: THEME.gray }}>{address.phone}</p>
          </div>
          <div className="rounded-lg p-4 mb-4 text-sm" style={{ background: THEME.cream }}>
            <p className="font-medium mb-1">Payment</p>
            <p style={{ color: THEME.gray }}>{payment === "upi" ? "UPI" : payment === "card" ? "Credit / Debit Card" : "Cash on Delivery"}</p>
          </div>
          <div className="rounded-lg p-4 mb-6 text-sm" style={{ background: THEME.cream }}>
            <p className="font-medium mb-2">{items.length} item(s)</p>
            {items.map((i) => (
              <div key={i.id} className="flex justify-between mb-1">
                <span style={{ color: THEME.gray }}>{i.name} x{i.qty}</span>
                <span>{inr(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="h-px my-2" style={{ background: THEME.line }} />
            <div className="flex justify-between font-semibold"><span>Total</span><span>{inr(total + shipping)}</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-6 py-3 rounded-full font-medium" style={{ border: `1px solid ${THEME.line}` }}>Back</button>
            <button disabled={placing} onClick={onPlace} className="flex-1 px-6 py-3 rounded-full font-medium disabled:opacity-50" style={{ background: THEME.gold, color: THEME.ink }}>
              {placing ? "Placing order\u2026" : "Place order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label className="text-xs flex-1" style={{ color: THEME.gray }}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg px-3 py-2.5 text-sm outline-none block"
        style={{ border: `1px solid ${THEME.line}`, color: THEME.ink, background: "white" }}
      />
    </label>
  );
}

/* ---------------- Confirmation & Orders ---------------- */
function ConfirmationPage({ order, goto }) {
  if (!order) return <EmptyState text="Order not found." />;
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-20 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: THEME.green }}>
        <CheckCircle2 size={32} color="white" />
      </div>
      <h1 className="font-serif-display text-3xl mb-2">Order placed</h1>
      <p style={{ color: THEME.gray }} className="mb-1">Order ID: {order.id}</p>
      <p style={{ color: THEME.gray }} className="mb-8">We'll deliver to {order.address.city}. Total: {inr(order.total)}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => goto("orders")} className="px-6 py-3 rounded-full font-medium" style={{ background: THEME.ink, color: THEME.cream }}>Track order</button>
        <button onClick={() => goto("home")} className="px-6 py-3 rounded-full font-medium" style={{ border: `1px solid ${THEME.line}` }}>Continue shopping</button>
      </div>
    </div>
  );
}

function OrdersPage({ orders, goto, onAdvance }) {
  if (orders.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <EmptyState text="No orders yet." action={{ label: "Start shopping", onClick: () => goto("home") }} />
      </div>
    );
  }
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-serif-display text-3xl sm:text-4xl mb-6">Your orders</h1>
      <div className="flex flex-col gap-6">
        {orders.map((o) => (
          <div key={o.id} className="rounded-lg p-5" style={{ background: THEME.cream }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="font-medium text-sm">{o.id}</p>
                <p className="text-xs" style={{ color: THEME.gray }}>{o.date.toLocaleDateString("en-IN")} · {o.items.length} item(s) · {inr(o.total)}</p>
              </div>
              {o.stage < STAGES.length - 1 && (
                <button onClick={() => onAdvance(o.id)} className="text-xs px-3 py-1.5 rounded-full" style={{ border: `1px solid ${THEME.line}` }}>
                  Simulate next step →
                </button>
              )}
            </div>
            <Timeline stage={o.stage} />
            <div className="flex gap-3 mt-4 overflow-x-auto">
              {o.items.map((it) => (
                <img key={it.id} src={img(it.seed, 100, 130)} className="w-12 h-16 object-cover rounded" alt="" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({ stage }) {
  return (
    <div className="flex items-center">
      {STAGES.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 0 }}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background: i <= stage ? THEME.green : "white", border: `1px solid ${i <= stage ? THEME.green : THEME.line}` }}
            >
              {i <= stage && <CheckCircle2 size={14} color="white" />}
            </div>
            <span className="text-[10px] text-center leading-tight" style={{ color: i <= stage ? THEME.ink : THEME.gray, maxWidth: 60 }}>{s}</span>
          </div>
          {i < STAGES.length - 1 && (
            <div className="flex-1 h-px mb-4" style={{ background: i < stage ? THEME.green : THEME.line }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------------- Admin ---------------- */
function AdminLocked({ setShowLogin }) {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <LayoutDashboard size={32} className="mx-auto mb-4" style={{ color: THEME.gray }} />
      <h1 className="font-serif-display text-2xl mb-2">Admin access needed</h1>
      <p className="text-sm mb-6" style={{ color: THEME.gray }}>Log in with the admin demo option to manage products and orders.</p>
      <button onClick={() => setShowLogin(true)} className="px-6 py-3 rounded-full font-medium" style={{ background: THEME.ink, color: THEME.cream }}>Log in</button>
    </div>
  );
}

function AdminPanel({ products, orders, tab, setTab, editingProduct, setEditingProduct, onSave, onDelete, backendConnected }) {
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-serif-display text-3xl sm:text-4xl mb-1">Admin panel</h1>
      <p className="text-sm mb-6" style={{ color: THEME.gray }}>
        {backendConnected ? "Connected to live database — changes are real and permanent." : "Demo data, in-memory only — resets on refresh."}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-8 max-w-lg">
        <Stat label="Products" value={products.length} />
        <Stat label="Orders" value={orders.length} />
        <Stat label="Revenue" value={inr(revenue)} />
      </div>

      <div className="flex gap-2 mb-6">
        {["products", "orders"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-full text-sm capitalize"
            style={{ background: tab === t ? THEME.ink : "transparent", color: tab === t ? THEME.cream : THEME.ink, border: `1px solid ${THEME.line}` }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "products" && (
        <div>
          <button
            onClick={() => setEditingProduct({ id: "", name: "", category: CATEGORIES[0].name, price: "", mrp: "", stock: "", seed: "new" + Date.now(), rating: "4.2", reviews: 0, desc: "", __isNew: true })}
            className="mb-4 px-4 py-2.5 rounded-full text-sm font-medium"
            style={{ background: THEME.gold, color: THEME.ink }}
          >
            + Add product
          </button>
          <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${THEME.line}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: THEME.cream }}>
                  <th className="text-left p-3 font-medium">Product</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Price</th>
                  <th className="text-left p-3 font-medium">Stock</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ borderTop: `1px solid ${THEME.line}` }}>
                    <td className="p-3 flex items-center gap-2">
                      <img src={img(p.seed, 60, 76)} className="w-8 h-10 object-cover rounded" alt="" /> {p.name}
                    </td>
                    <td className="p-3">{p.category}</td>
                    <td className="p-3">{inr(p.price)}</td>
                    <td className="p-3">{p.stock}</td>
                    <td className="p-3 flex gap-3">
                      <button onClick={() => setEditingProduct(p)}><Pencil size={15} /></button>
                      <button onClick={() => onDelete(p.id)} style={{ color: THEME.wine }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${THEME.line}` }}>
          {orders.length === 0 ? (
            <div className="p-8"><EmptyState text="No orders placed yet in this session." /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: THEME.cream }}>
                  <th className="text-left p-3 font-medium">Order ID</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium">Items</th>
                  <th className="text-left p-3 font-medium">Total</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderTop: `1px solid ${THEME.line}` }}>
                    <td className="p-3">{o.id}</td>
                    <td className="p-3">{o.address.name}</td>
                    <td className="p-3">{o.items.length}</td>
                    <td className="p-3">{inr(o.total)}</td>
                    <td className="p-3">{STAGES[o.stage]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editingProduct && (
        <ProductEditModal product={editingProduct} onClose={() => setEditingProduct(null)} onSave={onSave} />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg p-4" style={{ background: THEME.cream }}>
      <p className="text-xs mb-1" style={{ color: THEME.gray }}>{label}</p>
      <p className="font-serif-display text-xl">{value}</p>
    </div>
  );
}

function ProductEditModal({ product, onClose, onSave }) {
  const [form, setForm] = useState(product);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ background: "white" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif-display text-xl">{form.__isNew ? "Add product" : "Edit product"}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <Input label="Name" value={form.name} onChange={(v) => set("name", v)} />
          <label className="text-xs" style={{ color: THEME.gray }}>
            Category
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className="mt-1 w-full rounded-lg px-3 py-2.5 text-sm outline-none block" style={{ border: `1px solid ${THEME.line}` }}>
              {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          <div className="flex gap-3">
            <Input label="Price" value={form.price} onChange={(v) => set("price", v)} />
            <Input label="MRP" value={form.mrp} onChange={(v) => set("mrp", v)} />
          </div>
          <Input label="Stock" value={form.stock} onChange={(v) => set("stock", v)} />
          <Input label="Image URL (paste a photo link, or leave blank for a placeholder)" value={form.seed || form.imageSeed || ""} onChange={(v) => set("seed", v)} />
        </div>
        <button
          onClick={() =>
            onSave({
              ...form,
              id: form.id || form.name.replace(/\s/g, "") + Date.now(),
              price: Number(form.price) || 0,
              mrp: Number(form.mrp) || Number(form.price) || 0,
              stock: Number(form.stock) || 0,
              seed: form.seed || form.imageSeed || form.id || form.name,
            })
          }
          className="mt-5 w-full py-3 rounded-full font-medium"
          style={{ background: THEME.ink, color: "white" }}
        >
          Save product
        </button>
      </div>
    </div>
  );
}

/* ---------------- Login ---------------- */
function LoginModal({ onClose, onDemoLogin, onRealAuth, backendConnected, authError }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    await onRealAuth({ mode, name, email, password });
    setSubmitting(false);
  };

  // Backend not reachable yet: fall back to the old no-password demo flow
  if (backendConnected === false) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="rounded-xl p-6 w-full max-w-sm" style={{ background: "white" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif-display text-xl">Welcome to MELA</h2>
            <button onClick={onClose}><X size={18} /></button>
          </div>
          <div className="flex items-center gap-2 text-xs mb-4 p-2.5 rounded-lg" style={{ background: THEME.cream, color: THEME.gray }}>
            <WifiOff size={14} /> Backend not connected — showing demo login. Update API_BASE_URL and deploy the backend to enable real accounts.
          </div>
          <div className="flex flex-col gap-3 mb-4">
            <Input label="Your name" value={name} onChange={setName} />
            <Input label="Email" value={email} onChange={setEmail} />
          </div>
          <button
            disabled={!name}
            onClick={() => onDemoLogin({ name, email, isAdmin: false })}
            className="w-full py-3 rounded-full font-medium mb-2 disabled:opacity-40"
            style={{ background: THEME.ink, color: "white" }}
          >
            Continue as customer
          </button>
          <button
            onClick={() => onDemoLogin({ name: name || "Admin", email, isAdmin: true })}
            className="w-full py-3 rounded-full font-medium"
            style={{ border: `1px solid ${THEME.line}` }}
          >
            Continue as admin (demo)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="rounded-xl p-6 w-full max-w-sm" style={{ background: "white" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif-display text-xl">{mode === "login" ? "Log in to MELA" : "Create your account"}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="flex gap-2 mb-4 text-sm">
          <button
            onClick={() => setMode("login")}
            className="flex-1 py-2 rounded-full"
            style={{ background: mode === "login" ? THEME.ink : THEME.cream, color: mode === "login" ? "white" : THEME.ink }}
          >
            Log in
          </button>
          <button
            onClick={() => setMode("signup")}
            className="flex-1 py-2 rounded-full"
            style={{ background: mode === "signup" ? THEME.ink : THEME.cream, color: mode === "signup" ? "white" : THEME.ink }}
          >
            Sign up
          </button>
        </div>

        {authError && (
          <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: THEME.wine }}>{authError}</p>
        )}

        <div className="flex flex-col gap-3 mb-4">
          {mode === "signup" && <Input label="Your name" value={name} onChange={setName} />}
          <Input label="Email" value={email} onChange={setEmail} />
          <label className="text-xs" style={{ color: THEME.gray }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg px-3 py-2.5 text-sm outline-none block"
              style={{ border: `1px solid ${THEME.line}` }}
            />
          </label>
        </div>

        <button
          disabled={submitting || !email || !password || (mode === "signup" && !name)}
          onClick={submit}
          className="w-full py-3 rounded-full font-medium disabled:opacity-40"
          style={{ background: THEME.ink, color: "white" }}
        >
          {submitting ? "Please wait\u2026" : mode === "login" ? "Log in" : "Create account"}
        </button>
        <p className="text-xs mt-3 text-center" style={{ color: THEME.gray }}>
          Admin accounts are promoted from the backend (see README) — sign up normally, then run the make-admin script.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Shared bits ---------------- */
function EmptyState({ text, action }) {
  return (
    <div className="text-center py-10">
      <Package size={28} className="mx-auto mb-3" style={{ color: THEME.gray }} />
      <p style={{ color: THEME.gray }} className="mb-4">{text}</p>
      {action && (
        <button onClick={action.onClick} className="px-5 py-2.5 rounded-full text-sm font-medium" style={{ background: THEME.ink, color: "white" }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ background: THEME.ink, color: "rgba(255,255,255,0.6)" }} className="mt-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row justify-between gap-4 text-sm">
        <span className="font-serif-display text-lg" style={{ color: THEME.cream }}>MELA</span>
        <span>A frontend demo — no real payments or accounts.</span>
      </div>
    </footer>
  );
}
