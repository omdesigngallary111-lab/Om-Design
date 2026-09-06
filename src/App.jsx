import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute, { AdminOnlyRoute } from './components/AdminRoute.jsx'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import ContactFab from './components/ContactFab.jsx'
import Home from './pages/Home.jsx'

const About = lazy(() => import('./pages/About.jsx'))
const Contact = lazy(() => import('./pages/Contact.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'))
const Account = lazy(() => import('./pages/Account.jsx'))
const Categories = lazy(() => import('./pages/Categories.jsx'))
const Designs = lazy(() => import('./pages/Designs.jsx'))
const DesignDetail = lazy(() => import('./pages/DesignDetail.jsx'))
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'))
const Cart = lazy(() => import('./pages/Cart.jsx'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const AdminProducts = lazy(() => import('./pages/admin/Products.jsx'))
const AdminCategories = lazy(() => import('./pages/admin/Categories.jsx'))
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'))
const AdminOrders = lazy(() => import('./pages/admin/Orders.jsx'))
const AdminOffers = lazy(() => import('./pages/admin/Offers.jsx'))
const AdminSubcategories = lazy(() => import('./pages/admin/Subcategories.jsx'))
const AdminAdmissions = lazy(() => import('./pages/admin/Admissions.jsx'))
const AdminAdmissionDetail = lazy(() => import('./pages/admin/AdmissionDetail.jsx'))
const AdminAdmissionEdit = lazy(() => import('./pages/admin/AdmissionEdit.jsx'))
const AdminDesignTypes = lazy(() => import('./pages/admin/DesignTypes.jsx'))
const AdminAreaNeedle = lazy(() => import('./pages/admin/AreaNeedle.jsx'))
const AdminCarousel = lazy(() => import('./pages/admin/CarouselSlides.jsx'))
const CategoryDetail = lazy(() => import('./pages/CategoryDetail.jsx'))
const AdminAdmissionNew = lazy(() => import('./pages/admin/AdmissionNew.jsx'))

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-label="Loading page">
      <div className="w-8 h-8 border-2 border-maroon/30 border-t-maroon rounded-full animate-spin" />
    </div>
  )
}

function AdminOnly({ children }) {
  return <AdminOnlyRoute>{children}</AdminOnlyRoute>
}

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <AuthProvider>
      <CartProvider>
      <ToastProvider>
        <div className="min-h-screen flex flex-col">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50
                       focus:bg-maroon focus:text-ivory focus:px-4 focus:py-2 focus:rounded-sm"
          >
            Skip to content
          </a>
          {!isAdmin && <Navbar />}
          <main id="main-content" className="flex-1">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/categories/:slug" element={<CategoryDetail />} />
                <Route path="/designs" element={<Designs />} />
                <Route path="/designs/:slug" element={<DesignDetail />} />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <Account />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wishlist"
                  element={
                    <ProtectedRoute>
                      <Wishlist />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cart"
                  element={
                    <ProtectedRoute>
                      <Cart />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  }
                >
                  <Route
                    index
                    element={
                      <AdminOnly>
                        <AdminDashboard />
                      </AdminOnly>
                    }
                  />
                  <Route
                    path="products"
                    element={
                      <AdminOnly>
                        <AdminProducts />
                      </AdminOnly>
                    }
                  />
                  <Route
                    path="categories"
                    element={
                      <AdminOnly>
                        <AdminCategories />
                      </AdminOnly>
                    }
                  />
                  <Route
                    path="subcategories"
                    element={
                      <AdminOnly>
                        <AdminSubcategories />
                      </AdminOnly>
                    }
                  />
                  <Route path="admissions" element={<AdminAdmissions />} />
                  <Route path="admissions/new" element={<AdminAdmissionNew />} />
                  <Route path="admissions/:id" element={<AdminAdmissionDetail />} />
                  <Route
                    path="admissions/:id/edit"
                    element={
                      <AdminOnly>
                        <AdminAdmissionEdit />
                      </AdminOnly>
                    }
                  />
                  <Route
                    path="design-types"
                    element={
                      <AdminOnly>
                        <AdminDesignTypes />
                      </AdminOnly>
                    }
                  />
                  <Route
                    path="area-needle"
                    element={
                      <AdminOnly>
                        <AdminAreaNeedle />
                      </AdminOnly>
                    }
                  />
                  <Route
                    path="carousel"
                    element={
                      <AdminOnly>
                        <AdminCarousel />
                      </AdminOnly>
                    }
                  />
                  <Route
                    path="users"
                    element={
                      <AdminOnly>
                        <AdminUsers />
                      </AdminOnly>
                    }
                  />
                  <Route
                    path="orders"
                    element={
                      <AdminOnly>
                        <AdminOrders />
                      </AdminOnly>
                    }
                  />
                  <Route
                    path="offers"
                    element={
                      <AdminOnly>
                        <AdminOffers />
                      </AdminOnly>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </main>
          {!isAdmin && <Footer />}
          {!isAdmin && <ContactFab />}
        </div>
      </ToastProvider>
      </CartProvider>
    </AuthProvider>
  )
}
