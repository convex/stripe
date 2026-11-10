import "./App.css";
import { SignInButton, SignOutButton, useUser } from "@clerk/clerk-react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

type Page = "home" | "store" | "profile" | "team";

// ============================================================================
// SHARED UTILITIES
// ============================================================================

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function getStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; class: string }> = {
    active: { label: "Active", class: "status-active" },
    canceled: { label: "Canceled", class: "status-canceled" },
    past_due: { label: "Past Due", class: "status-error" },
    unpaid: { label: "Unpaid", class: "status-error" },
    trialing: { label: "Trial", class: "status-info" },
    succeeded: { label: "Paid", class: "status-active" },
    pending: { label: "Pending", class: "status-warning" },
    paid: { label: "Paid", class: "status-active" },
    open: { label: "Open", class: "status-warning" },
    refunded: { label: "Refunded", class: "status-canceled" },
    partially_refunded: {
      label: "Partially refunded",
      class: "status-warning",
    },
  };
  const statusInfo = statusMap[status] || {
    label: status,
    class: "status-default",
  };
  return (
    <span className={`status-badge ${statusInfo.class}`}>
      {statusInfo.label}
    </span>
  );
}

// ============================================================================
// NAVBAR
// ============================================================================
function Navbar({
  currentPage,
  setCurrentPage,
}: {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}) {
  const { isSignedIn } = useUser();

  return (
    <nav className="navbar">
      <span className="navbar-brand" onClick={() => setCurrentPage("home")}>
        Benji's Store
      </span>
      <div className="navbar-links">
        <button
          className={`nav-link ${currentPage === "home" ? "active" : ""}`}
          onClick={() => setCurrentPage("home")}
        >
          Home
        </button>
        <button
          className={`nav-link ${currentPage === "store" ? "active" : ""}`}
          onClick={() => setCurrentPage("store")}
        >
          Store
        </button>
        {isSignedIn && (
          <>
            <button
              className={`nav-link ${currentPage === "profile" ? "active" : ""}`}
              onClick={() => setCurrentPage("profile")}
            >
              Profile
            </button>
            <button
              className={`nav-link ${currentPage === "team" ? "active" : ""}`}
              onClick={() => setCurrentPage("team")}
            >
              Team
            </button>
          </>
        )}
        {isSignedIn ? (
          <SignOutButton>
            <button className="btn-nav btn-nav-outline">Sign out</button>
          </SignOutButton>
        ) : (
          <SignInButton mode="modal">
            <button className="btn-nav btn-nav-primary">Sign in</button>
          </SignInButton>
        )}
      </div>
    </nav>
  );
}

// ============================================================================
// FAILED PAYMENT BANNER (#9)
// ============================================================================
function FailedPaymentBanner() {
  const failedSubscriptions = useQuery(
    api.stripe.getFailedPaymentSubscriptions,
  );
  const getPortalUrl = useAction(api.stripe.getCustomerPortalUrl);
  const [loading, setLoading] = useState(false);

  if (!failedSubscriptions || failedSubscriptions.length === 0) return null;

  const handleRetry = async () => {
    setLoading(true);
    try {
      const result = await getPortalUrl({});
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Error getting portal URL:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="failed-payment-banner">
      <div className="banner-icon">⚠️</div>
      <div className="banner-content">
        <strong>Payment Failed</strong>
        <p>
          Your subscription payment couldn't be processed. Please update your
          payment method to continue.
        </p>
      </div>
      <button className="btn-retry" onClick={handleRetry} disabled={loading}>
        {loading ? "Loading..." : "Update Payment Method"}
      </button>
    </div>
  );
}

// ============================================================================
// LANDING PAGE
// ============================================================================
function Hero({ setCurrentPage }: { setCurrentPage: (page: Page) => void }) {
  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-content">
          <div className="hero-badge">Stripe Component Demo</div>
          <h1 className="hero-title">
            Premium hats,
            <br />
            <em>delivered monthly</em>
          </h1>
          <p className="hero-subtitle">
            The perfect example app for testing the @convex-dev/stripe
            component. Buy a single hat or subscribe for monthly deliveries.
          </p>
          <div className="hero-buttons">
            <button
              className="btn-primary"
              onClick={() => setCurrentPage("store")}
            >
              Shop now
              <span>→</span>
            </button>
            <a
              href="https://github.com/get-convex/convex-stripe"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              View source
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card">
            <div className="card-header">
              <span className="card-dot"></span>
              <span className="card-dot"></span>
              <span className="card-dot"></span>
            </div>
            <div className="card-code">
              <div>
                <span className="code-comment">// One-time payment</span>
              </div>
              <div>
                <span className="code-keyword">const</span>{" "}
                <span className="code-variable">checkout</span> ={" "}
                <span className="code-function">useAction</span>(
              </div>
              <div>
                &nbsp;&nbsp;api.stripe.
                <span className="code-function">createPaymentCheckout</span>
              </div>
              <div>);</div>
              <br />
              <div>
                <span className="code-comment">// Or subscribe monthly</span>
              </div>
              <div>
                <span className="code-keyword">const</span>{" "}
                <span className="code-variable">subscribe</span> ={" "}
                <span className="code-function">useAction</span>(
              </div>
              <div>
                &nbsp;&nbsp;api.stripe.
                <span className="code-function">
                  createSubscriptionCheckout
                </span>
              </div>
              <div>);</div>
            </div>
          </div>
          <div className="hero-floating-card">
            <div className="floating-card-label">Starting at</div>
            <div className="floating-card-value">$29/mo</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: "🎩",
      title: "Premium Quality",
      description:
        "Each hat is handcrafted with the finest materials. Built to last.",
    },
    {
      icon: "📦",
      title: "Monthly Delivery",
      description:
        "Subscribe and get a new hat delivered to your door every month.",
    },
    {
      icon: "💳",
      title: "Stripe Powered",
      description:
        "Secure payments via Stripe Checkout. Manage billing in the Customer Portal.",
    },
    {
      icon: "⚡",
      title: "Real-time Sync",
      description:
        "Convex webhooks keep your subscription status always up to date.",
    },
    {
      icon: "👥",
      title: "Team Billing",
      description: "Seat-based pricing for teams. Add or remove seats anytime.",
    },
    {
      icon: "📊",
      title: "Order History",
      description:
        "Track all your orders and subscription status in your profile.",
    },
  ];

  return (
    <section className="features">
      <div className="features-header">
        <span className="section-badge">How It Works</span>
        <h2 className="section-title">Payments made simple</h2>
        <p className="section-subtitle">
          Built with the @convex-dev/stripe component for seamless Stripe
          integration.
        </p>
      </div>
      <div className="features-grid">
        {features.map((feature, index) => (
          <div className="feature-card" key={index}>
            <div className="feature-icon">{feature.icon}</div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-description">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA({ setCurrentPage }: { setCurrentPage: (page: Page) => void }) {
  return (
    <section className="cta">
      <div className="cta-container">
        <h2 className="cta-title">Ready to get your hat?</h2>
        <p className="cta-subtitle">
          Choose a one-time purchase or subscribe for monthly deliveries.
        </p>
        <button className="btn-cta" onClick={() => setCurrentPage("store")}>
          Browse products
          <span>→</span>
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <span className="footer-brand">Benji's Store</span>
        <div className="footer-links">
          <a
            href="https://docs.convex.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Convex Docs
          </a>
          <a
            href="https://stripe.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Stripe Docs
          </a>
          <a
            href="https://clerk.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Clerk Docs
          </a>
        </div>
        <div className="footer-copyright">
          Built with Convex + Stripe + Clerk
        </div>
      </div>
    </footer>
  );
}

function LandingPage({
  setCurrentPage,
}: {
  setCurrentPage: (page: Page) => void;
}) {
  return (
    <>
      <Hero setCurrentPage={setCurrentPage} />
      <Features />
      <CTA setCurrentPage={setCurrentPage} />
      <Footer />
    </>
  );
}

// ============================================================================
// STORE PAGE
// ============================================================================

// Price IDs from environment variables (set in .env.local)
const STRIPE_ONE_TIME_PRICE_ID = import.meta.env.VITE_STRIPE_ONE_TIME_PRICE_ID;
const STRIPE_SUBSCRIPTION_PRICE_ID = import.meta.env
  .VITE_STRIPE_SUBSCRIPTION_PRICE_ID;

const PRODUCTS = {
  oneTimeHat: {
    id: "one-time-hat",
    name: "Benji's Hat",
    description: "A premium, handcrafted hat. One-time purchase.",
    price: 49,
    priceId: STRIPE_ONE_TIME_PRICE_ID,
    type: "payment" as const,
    emoji: "🎩",
  },
  monthlySubscription: {
    id: "monthly-hat",
    name: "Hat of the Month Club",
    description:
      "Get a new exclusive hat delivered every month. Cancel anytime.",
    price: 29,
    priceId: STRIPE_SUBSCRIPTION_PRICE_ID,
    type: "subscription" as const,
    emoji: "📦",
    interval: "month",
    // Note: For team/seat-based subscriptions, use the Team Billing page
  },
};

function ProductCard({
  product,
  onPurchase,
  loading,
}: {
  product: typeof PRODUCTS.oneTimeHat | typeof PRODUCTS.monthlySubscription;
  onPurchase: () => void;
  loading: boolean;
}) {
  const isSubscription = product.type === "subscription";

  return (
    <div className="product-card-large">
      <div className="product-image-large">
        {product.emoji}
        {isSubscription && <div className="product-badge">Monthly</div>}
      </div>
      <div className="product-info-large">
        <span className="product-category">
          {isSubscription ? "Subscription" : "One-time Purchase"}
        </span>
        <h3 className="product-name-large">{product.name}</h3>
        <p className="product-description-large">{product.description}</p>

        <div className="product-price-large">
          ${product.price}
          {isSubscription && <span className="price-interval">/month</span>}
        </div>

        <button
          className="btn-purchase"
          onClick={onPurchase}
          disabled={loading}
        >
          {loading ? "Loading..." : isSubscription ? "Subscribe" : "Buy Now"}
          {!loading && <span>→</span>}
        </button>
      </div>
    </div>
  );
}

function StorePage({
  setCurrentPage,
}: {
  setCurrentPage: (page: Page) => void;
}) {
  const { isSignedIn, user } = useUser();
  const [loading, setLoading] = useState<string | null>(null);

  const createPaymentCheckout = useAction(api.stripe.createPaymentCheckout);
  const createSubscriptionCheckout = useAction(
    api.stripe.createSubscriptionCheckout,
  );

  if (!isSignedIn) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-icon">🎩</div>
          <h2 className="auth-title">Welcome to Benji's Store</h2>
          <p className="auth-subtitle">
            Sign in to purchase hats or manage your subscription
          </p>
          <SignInButton mode="modal">
            <button className="btn-primary">
              Sign in to continue
              <span>→</span>
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  const handlePurchase = async (
    product: typeof PRODUCTS.oneTimeHat | typeof PRODUCTS.monthlySubscription,
  ) => {
    setLoading(product.id);
    try {
      let result;
      if (product.type === "subscription") {
        // User subscription - quantity 1
        result = await createSubscriptionCheckout({ priceId: product.priceId });
      } else {
        result = await createPaymentCheckout({ priceId: product.priceId });
      }

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert(
        "Failed to create checkout session. Make sure your Stripe Price IDs are configured.",
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="store-page">
      <FailedPaymentBanner />

      <div className="user-welcome">
        <div className="user-card">
          <div className="user-info">
            <div className="user-avatar">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt="Avatar"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                user?.firstName?.[0] || "?"
              )}
            </div>
            <div className="user-details">
              <h3>Welcome, {user?.firstName || "Shopper"}!</h3>
              <p>{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
          <button
            className="btn-profile"
            onClick={() => setCurrentPage("profile")}
          >
            View Profile
          </button>
        </div>
      </div>

      <div className="store-header">
        <h1 className="store-title">Choose Your Hat</h1>
        <p className="store-subtitle">
          One-time purchase or monthly subscription
        </p>
      </div>

      <div className="products-container">
        <ProductCard
          product={PRODUCTS.oneTimeHat}
          onPurchase={() => handlePurchase(PRODUCTS.oneTimeHat)}
          loading={loading === PRODUCTS.oneTimeHat.id}
        />
        <ProductCard
          product={PRODUCTS.monthlySubscription}
          onPurchase={() => handlePurchase(PRODUCTS.monthlySubscription)}
          loading={loading === PRODUCTS.monthlySubscription.id}
        />
      </div>

      <div className="store-note">
        <div className="note-icon">💡</div>
        <div className="note-content">
          <strong>Testing the integration?</strong>
          <p>
            Replace the <code>priceId</code> values in <code>App.tsx</code> with
            your actual Stripe Price IDs. Use <code>4242 4242 4242 4242</code>{" "}
            as a test card number.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}

// ============================================================================
// PROFILE PAGE
// ============================================================================

function ProfilePage({
  setCurrentPage,
}: {
  setCurrentPage: (page: Page) => void;
}) {
  const { isSignedIn, user } = useUser();
  const subscriptions = useQuery(api.stripe.getUserSubscriptions);
  const payments = useQuery(api.stripe.getUserPayments);
  const cancelSubscriptionAction = useAction(api.stripe.cancelSubscription);
  const reactivateSubscriptionAction = useAction(
    api.stripe.reactivateSubscription,
  );
  const getPortalUrl = useAction(api.stripe.getCustomerPortalUrl);

  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  if (!isSignedIn) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <h2 className="auth-title">Profile</h2>
          <p className="auth-subtitle">
            Sign in to view your orders and subscription
          </p>
          <SignInButton mode="modal">
            <button className="btn-primary">
              Sign in
              <span>→</span>
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (
      !confirm(
        "Are you sure you want to cancel? Your subscription will remain active until the end of the current billing period.",
      )
    ) {
      return;
    }

    setCancelingId(subscriptionId);
    try {
      await cancelSubscriptionAction({ subscriptionId });
    } catch (error) {
      console.error("Cancel error:", error);
      alert("Failed to cancel subscription");
    } finally {
      setCancelingId(null);
    }
  };

  const handleReactivateSubscription = async (subscriptionId: string) => {
    setReactivatingId(subscriptionId);
    try {
      await reactivateSubscriptionAction({ subscriptionId });
    } catch (error) {
      console.error("Reactivate error:", error);
      alert("Failed to reactivate subscription");
    } finally {
      setReactivatingId(null);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const result = await getPortalUrl({});
      if (result?.url) {
        window.location.href = result.url;
      } else {
        alert("No billing history found. Make a purchase first!");
      }
    } catch (error) {
      console.error("Portal error:", error);
      alert("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const activeSubscriptions =
    subscriptions?.filter(
      (s: { status: string }) =>
        s.status === "active" || s.status === "past_due",
    ) || [];
  const hasActiveSubscription = activeSubscriptions.length > 0;
  const hasAnyBilling =
    (subscriptions && subscriptions.length > 0) ||
    (payments && payments.length > 0);

  return (
    <div className="profile-page">
      <FailedPaymentBanner />

      {/* User Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="Avatar" />
          ) : (
            <span>{user?.firstName?.[0] || "?"}</span>
          )}
        </div>
        <div className="profile-info">
          <h1 className="profile-name">{user?.fullName || "User"}</h1>
          <p className="profile-email">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
        {/* #6 - Manage Billing Button */}
        {hasAnyBilling && (
          <button
            className="btn-manage-billing"
            onClick={handleManageBilling}
            disabled={portalLoading}
          >
            {portalLoading ? "Loading..." : "Manage Billing →"}
          </button>
        )}
      </div>

      {/* Subscription Section */}
      <section className="profile-section">
        <div className="section-header">
          <h2>📦 Subscription</h2>
          {!hasActiveSubscription && (
            <button
              className="btn-small"
              onClick={() => setCurrentPage("store")}
            >
              Subscribe
            </button>
          )}
        </div>

        {subscriptions === undefined ? (
          <div className="loading-state">Loading subscriptions...</div>
        ) : subscriptions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No active subscription</h3>
            <p>
              Subscribe to the Hat of the Month Club to get a new hat delivered
              every month!
            </p>
            <button
              className="btn-primary"
              onClick={() => setCurrentPage("store")}
            >
              View Plans
              <span>→</span>
            </button>
          </div>
        ) : (
          <div className="subscription-list">
            {subscriptions.map(
              (sub: {
                stripeSubscriptionId: string;
                stripeCustomerId: string;
                status: string;
                currentPeriodEnd: number;
                cancelAtPeriodEnd: boolean;
                quantity?: number;
              }) => (
                <div
                  key={sub.stripeSubscriptionId}
                  className="subscription-card"
                >
                  <div className="subscription-header">
                    <div className="subscription-icon">🎩</div>
                    <div className="subscription-details">
                      <h3>Hat of the Month Club</h3>
                      {getStatusBadge(sub.status)}
                    </div>
                  </div>

                  <div className="subscription-meta">
                    <div className="meta-item">
                      <span className="meta-label">Next delivery</span>
                      <span className="meta-value">
                        {formatDate(sub.currentPeriodEnd)}
                      </span>
                    </div>
                    {sub.cancelAtPeriodEnd && (
                      <div className="meta-item">
                        <span className="meta-label cancel-notice">
                          Cancels on
                        </span>
                        <span className="meta-value">
                          {formatDate(sub.currentPeriodEnd)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Failed Payment Retry */}
                  {sub.status === "past_due" && (
                    <button
                      className="btn-retry-payment"
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                    >
                      {portalLoading
                        ? "Loading..."
                        : "⚠️ Update Payment Method"}
                    </button>
                  )}

                  {sub.status === "active" && !sub.cancelAtPeriodEnd && (
                    <button
                      className="btn-cancel"
                      onClick={() =>
                        handleCancelSubscription(sub.stripeSubscriptionId)
                      }
                      disabled={cancelingId === sub.stripeSubscriptionId}
                    >
                      {cancelingId === sub.stripeSubscriptionId
                        ? "Canceling..."
                        : "Cancel Subscription"}
                    </button>
                  )}
                  {sub.cancelAtPeriodEnd && (
                    <div className="cancel-notice-banner">
                      ⚠️ Your subscription will end on{" "}
                      {formatDate(sub.currentPeriodEnd)}
                      <button
                        className="btn-reactivate"
                        onClick={() =>
                          handleReactivateSubscription(sub.stripeSubscriptionId)
                        }
                        disabled={reactivatingId === sub.stripeSubscriptionId}
                      >
                        {reactivatingId === sub.stripeSubscriptionId
                          ? "Reactivating..."
                          : "Reactivate"}
                      </button>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </section>

      {/* Order History Section */}
      <section className="profile-section">
        <div className="section-header">
          <h2>🧾 Order History</h2>
        </div>

        {payments === undefined ? (
          <div className="loading-state">Loading orders...</div>
        ) : payments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛒</div>
            <h3>No orders yet</h3>
            <p>
              Your purchase history will appear here after your first order.
            </p>
            <button
              className="btn-primary"
              onClick={() => setCurrentPage("store")}
            >
              Shop Now
              <span>→</span>
            </button>
          </div>
        ) : (
          <div className="orders-table">
            <div className="table-header">
              <span>Date</span>
              <span>Product</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {payments.map((payment) => (
              <div key={payment.stripePaymentIntentId} className="table-row">
                <span className="order-date">
                  {formatDate(payment.created)}
                </span>
                <span className="order-product">
                  <span className="product-icon">🎩</span>
                  Benji's Hat
                </span>
                <span className="order-amount">
                  {formatCurrency(payment.amount, payment.currency)}
                </span>
                <span>
                  {getStatusBadge(
                    payment.refunded
                      ? "refunded"
                      : payment.amountRefunded
                        ? "partially_refunded"
                        : payment.status,
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

// ============================================================================
// TEAM BILLING PAGE (#4 - Organization-Based Lookups)
// ============================================================================

function TeamBillingPage() {
  const { isSignedIn } = useUser();
  const [orgId, setOrgId] = useState("demo-org-123");

  // Using the org-based queries
  const orgSubscription = useQuery(api.stripe.getOrgSubscription, { orgId });
  const orgInvoices = useQuery(api.stripe.getOrgInvoices, { orgId });
  const updateSeatsAction = useAction(api.stripe.updateSeats);
  const createTeamCheckout = useAction(
    api.stripe.createTeamSubscriptionCheckout,
  );
  const cancelSubscriptionAction = useAction(api.stripe.cancelSubscription);
  const reactivateSubscriptionAction = useAction(
    api.stripe.reactivateSubscription,
  );
  const [updatingSeats, setUpdatingSeats] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [teamSeats, setTeamSeats] = useState(3);

  if (!isSignedIn) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <h2 className="auth-title">Team Billing</h2>
          <p className="auth-subtitle">
            Sign in to manage your team's subscription
          </p>
          <SignInButton mode="modal">
            <button className="btn-primary">
              Sign in
              <span>→</span>
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  const handleUpdateSeats = async (newCount: number) => {
    if (!orgSubscription) return;
    setUpdatingSeats(true);
    try {
      await updateSeatsAction({
        subscriptionId: orgSubscription.stripeSubscriptionId,
        seatCount: newCount,
      });
    } catch (error) {
      console.error("Update seats error:", error);
    } finally {
      setUpdatingSeats(false);
    }
  };

  const handleTeamSubscribe = async () => {
    setSubscribing(true);
    try {
      const result = await createTeamCheckout({
        priceId: STRIPE_SUBSCRIPTION_PRICE_ID,
        orgId: orgId,
        quantity: teamSeats,
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Team checkout error:", error);
      alert("Failed to create checkout. Please try again.");
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancelTeamSubscription = async () => {
    if (!orgSubscription) return;
    if (
      !confirm(
        "Are you sure you want to cancel? Your team subscription will remain active until the end of the current billing period.",
      )
    ) {
      return;
    }

    setCanceling(true);
    try {
      await cancelSubscriptionAction({
        subscriptionId: orgSubscription.stripeSubscriptionId,
      });
    } catch (error) {
      console.error("Cancel error:", error);
      alert("Failed to cancel subscription");
    } finally {
      setCanceling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!orgSubscription) return;

    setReactivating(true);
    try {
      await reactivateSubscriptionAction({
        subscriptionId: orgSubscription.stripeSubscriptionId,
      });
    } catch (error) {
      console.error("Reactivate error:", error);
      alert("Failed to reactivate subscription");
    } finally {
      setReactivating(false);
    }
  };

  return (
    <div className="profile-page">
      {/* Team Header */}
      <div className="profile-header team-header">
        <div className="profile-avatar team-avatar">
          <span>👥</span>
        </div>
        <div className="profile-info">
          <h1 className="profile-name">Team Billing</h1>
          <p className="profile-email">
            Organization-based subscription management
          </p>
        </div>
      </div>

      {/* Organization ID Demo */}
      <section className="profile-section">
        <div className="section-header">
          <h2>🏢 Organization Lookup</h2>
        </div>
        <div className="org-lookup-demo">
          <p className="demo-note">
            This demonstrates <code>getSubscriptionByOrgId</code> and{" "}
            <code>listPaymentsByOrgId</code>. In a real app, the orgId would
            come from your auth provider (e.g., Clerk Organizations).
          </p>
          <div className="org-input-group">
            <label>Organization ID:</label>
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Enter organization ID"
            />
          </div>
        </div>
      </section>

      {/* Team Subscription */}
      <section className="profile-section">
        <div className="section-header">
          <h2>📦 Team Subscription</h2>
        </div>

        {orgSubscription === undefined ? (
          <div className="loading-state">Loading team subscription...</div>
        ) : orgSubscription === null ? (
          <div className="empty-state team-subscribe-empty">
            <div className="empty-icon">👥</div>
            <h3>Start a Team Subscription</h3>
            <p>Subscribe your organization to the Hat of the Month Club</p>

            {/* Team Size Selector */}
            <div className="team-subscribe-form">
              <div className="team-size-selector">
                <label>Team Size</label>
                <div className="team-seats-controls">
                  <button
                    className="seat-btn-lg"
                    onClick={() => setTeamSeats(Math.max(1, teamSeats - 1))}
                    disabled={teamSeats <= 1}
                  >
                    −
                  </button>
                  <div className="team-seats-display">
                    <span className="seats-number">{teamSeats}</span>
                    <span className="seats-text">seats</span>
                  </div>
                  <button
                    className="seat-btn-lg"
                    onClick={() => setTeamSeats(teamSeats + 1)}
                  >
                    +
                  </button>
                </div>
                <p className="seats-price">
                  ${PRODUCTS.monthlySubscription.price * teamSeats}/month
                </p>
              </div>

              <button
                className="btn-primary btn-large"
                onClick={handleTeamSubscribe}
                disabled={subscribing}
              >
                {subscribing
                  ? "Creating checkout..."
                  : `Subscribe Team for $${PRODUCTS.monthlySubscription.price * teamSeats}/mo`}
                <span>→</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="subscription-card team-subscription">
            <div className="subscription-header">
              <div className="subscription-icon">🎩</div>
              <div className="subscription-details">
                <h3>Team Hat Subscription</h3>
                {getStatusBadge(orgSubscription.status)}
              </div>
            </div>

            {/* Seat Management - Disabled when canceling */}
            <div
              className={`team-seats-section ${orgSubscription.cancelAtPeriodEnd ? "disabled" : ""}`}
            >
              <h4>Team Seats</h4>
              {orgSubscription.cancelAtPeriodEnd && (
                <p className="seats-disabled-notice">
                  Seat management disabled for canceling subscriptions
                </p>
              )}
              <div className="team-seats-controls">
                <button
                  className="seat-btn-lg"
                  onClick={() =>
                    handleUpdateSeats(
                      Math.max(1, (orgSubscription.quantity || 1) - 1),
                    )
                  }
                  disabled={
                    updatingSeats ||
                    (orgSubscription.quantity || 1) <= 1 ||
                    orgSubscription.cancelAtPeriodEnd
                  }
                >
                  −
                </button>
                <div className="team-seats-display">
                  <span className="seats-number">
                    {updatingSeats ? "..." : orgSubscription.quantity || 1}
                  </span>
                  <span className="seats-text">seats</span>
                </div>
                <button
                  className="seat-btn-lg"
                  onClick={() =>
                    handleUpdateSeats((orgSubscription.quantity || 1) + 1)
                  }
                  disabled={updatingSeats || orgSubscription.cancelAtPeriodEnd}
                >
                  +
                </button>
              </div>
              <p className="seats-price">
                $
                {PRODUCTS.monthlySubscription.price *
                  (orgSubscription.quantity || 1)}
                /month
              </p>
            </div>

            <div className="subscription-meta">
              <div className="meta-item">
                <span className="meta-label">
                  {orgSubscription.cancelAtPeriodEnd
                    ? "Cancels on"
                    : "Next billing date"}
                </span>
                <span className="meta-value">
                  {formatDate(orgSubscription.currentPeriodEnd)}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Organization ID</span>
                <span className="meta-value">
                  {orgSubscription.orgId || "Not linked"}
                </span>
              </div>
            </div>

            {/* Cancellation Notice & Reactivate Button */}
            {orgSubscription.cancelAtPeriodEnd && (
              <div className="cancel-notice-banner">
                ⚠️ This subscription will be canceled on{" "}
                {formatDate(orgSubscription.currentPeriodEnd)}
                <button
                  className="btn-reactivate"
                  onClick={handleReactivateSubscription}
                  disabled={reactivating}
                >
                  {reactivating ? "Reactivating..." : "Reactivate Subscription"}
                </button>
              </div>
            )}

            {/* Cancel Button (only show if not already canceling) */}
            {orgSubscription.status === "active" &&
              !orgSubscription.cancelAtPeriodEnd && (
                <button
                  className="btn-cancel"
                  onClick={handleCancelTeamSubscription}
                  disabled={canceling}
                >
                  {canceling ? "Canceling..." : "Cancel Subscription"}
                </button>
              )}
          </div>
        )}
      </section>

      {/* Team Invoices */}
      <section className="profile-section">
        <div className="section-header">
          <h2>🧾 Team Invoice History</h2>
        </div>

        {orgInvoices === undefined ? (
          <div className="loading-state">Loading team invoices...</div>
        ) : orgInvoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            <h3>No invoices yet</h3>
            <p>
              Team invoice history will appear here after your first billing
              cycle.
            </p>
          </div>
        ) : (
          <div className="orders-table">
            <div className="table-header">
              <span>Date</span>
              <span>Description</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {orgInvoices.map((invoice) => (
              <div key={invoice.stripeInvoiceId} className="table-row">
                <span className="order-date">
                  {formatDate(invoice.created)}
                </span>
                <span className="order-product">
                  <span className="product-icon">🎩</span>
                  Team Subscription
                </span>
                <span className="order-amount">
                  {formatCurrency(
                    invoice.amountPaid || invoice.amountDue,
                    "usd",
                  )}
                </span>
                <span>{getStatusBadge(invoice.status)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");

  // Check for success/cancel URL params and track in state
  const urlParams = new URLSearchParams(window.location.search);
  const [showSuccess, setShowSuccess] = useState(
    urlParams.get("success") === "true",
  );
  const [showCanceled, setShowCanceled] = useState(
    urlParams.get("canceled") === "true",
  );

  const dismissToast = (type: "success" | "canceled") => {
    if (type === "success") setShowSuccess(false);
    if (type === "canceled") setShowCanceled(false);
    window.history.replaceState({}, "", window.location.pathname);
  };

  return (
    <>
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      {/* Success/Cancel Messages */}
      {showSuccess && (
        <div className="toast toast-success">
          <span>✅</span> Payment successful! Thank you for your purchase.
          <button onClick={() => dismissToast("success")}>×</button>
        </div>
      )}
      {showCanceled && (
        <div className="toast toast-warning">
          <span>ℹ️</span> Payment canceled.
          <button onClick={() => dismissToast("canceled")}>×</button>
        </div>
      )}

      {currentPage === "home" && (
        <LandingPage setCurrentPage={setCurrentPage} />
      )}
      {currentPage === "store" && <StorePage setCurrentPage={setCurrentPage} />}
      {currentPage === "profile" && (
        <ProfilePage setCurrentPage={setCurrentPage} />
      )}
      {currentPage === "team" && <TeamBillingPage />}
    </>
  );
}

export default App;
