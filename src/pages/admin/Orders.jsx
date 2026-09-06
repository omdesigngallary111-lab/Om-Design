import { useEffect, useState } from "react";
import Seo from "../../components/Seo.jsx";
import Pagination from "../../components/Pagination.jsx";
import PageHeader from "../../components/admin/PageHeader.jsx";
import SearchBar from "../../components/admin/SearchBar.jsx";
import Badge from "../../components/admin/Badge.jsx";
import EmptyState from "../../components/admin/EmptyState.jsx";
import Alert from "../../components/admin/Alert.jsx";
import { AdminTable } from "../../components/admin/AdminTable.jsx";
import { TableSkeleton } from "../../components/admin/Skeleton.jsx";
import { IconOrders } from "../../components/admin/icons.jsx";
import { fetchOrdersAdmin } from "../../lib/admin.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

const tableColumns = [
  { key: "order", label: "Order" },
  { key: "customer", label: "Customer" },
  { key: "design", label: "Design" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "created", label: "Created" },
  { key: "paymentRef", label: "Payment Ref" },
];

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusVariant(status) {
  if (status === "paid") return "paid";
  if (status === "pending") return "pending";
  if (status === "failed") return "failed";
  return "draft";
}

function orderDesignLabel(order) {
  const items = order.order_items || [];
  if (items.length === 1) return items[0].design_name || order.designs?.name || "—";
  if (items.length > 1) {
    const first = items[0].design_name || "Design";
    return `${first} +${items.length - 1} more`;
  }
  return order.designs?.name || "—";
}

function orderDesignSub(order) {
  const items = order.order_items || [];
  if (items.length > 1) return `${items.length} designs`;
  return order.designs?.slug || items[0]?.design_id?.slice?.(0, 8) || "—";
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const debouncedQuery = useDebouncedValue(query);
  const hasFilters = Boolean(debouncedQuery.trim()) || statusFilter !== "all";

  useEffect(() => {
    setLoading(true);
    fetchOrdersAdmin({
      page,
      pageSize,
      query: debouncedQuery,
      status: statusFilter,
    }).then(({ orders: rows, total: t, error: err }) => {
      setOrders(rows);
      setTotal(t);
      setError(err ?? "");
      setLoading(false);
    });
  }, [page, pageSize, debouncedQuery, statusFilter]);

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <div>
      <Seo title="Orders" noIndex />
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"} across paid, pending, and failed payments.`}
      />

      {error && <Alert>{error}</Alert>}

      <SearchBar
        value={query}
        onChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder="Search by order, payment ref, customer, or design…"
        filters={STATUS_FILTERS}
        activeFilter={statusFilter}
        onFilter={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />

      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : total === 0 && !hasFilters ? (
        <div className="admin-card">
          <EmptyState
            icon={<IconOrders className="w-7 h-7" />}
            title="No orders yet"
            description="Orders will appear here after customers start completing checkout."
          />
        </div>
      ) : total === 0 ? (
        <div className="admin-card">
          <EmptyState
            icon={<IconOrders className="w-7 h-7" />}
            title="No matches"
            description="Try a different search term or status filter."
          />
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <AdminTable columns={tableColumns} minWidth={880}>
              {orders.map((order) => {
                const customer = order.profiles || {};
                return (
                  <tr
                    key={order.id}
                    className="hover:bg-sand/40 transition-colors duration-150"
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="font-semibold text-ink">
                        #{order.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-ink-soft mt-0.5">Order ID</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="max-w-[12rem]" title={customer.full_name || undefined}>
                        <p className="font-semibold text-ink truncate">
                          {customer.full_name || "—"}
                        </p>
                        <p className="text-xs text-ink-soft truncate mt-0.5">
                          {customer.phone ||
                            customer.email ||
                            "No contact info"}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="max-w-[14rem]" title={orderDesignLabel(order)}>
                        <p className="font-semibold text-ink truncate">
                          {orderDesignLabel(order)}
                        </p>
                        <p className="text-xs text-ink-soft truncate mt-0.5">
                          {orderDesignSub(order)}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-ink tabular-nums whitespace-nowrap">
                      {formatMoney(order.amount)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Badge variant={statusVariant(order.status)}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-ink-soft whitespace-nowrap">
                      {formatDate(order.created_at)}
                    </td>
                    <td
                      className="px-5 py-3.5"
                      title={order.razorpay_order_id || undefined}
                    >
                      <code className="block max-w-[10rem] text-xs text-ink-soft bg-sand px-2 py-0.5 rounded-md truncate">
                        {order.razorpay_order_id || "—"}
                      </code>
                    </td>
                  </tr>
                );
              })}
            </AdminTable>
          </div>

          <div className="md:hidden space-y-3">
            {orders.map((order) => {
              const customer = order.profiles || {};
              return (
                <article key={order.id} className="admin-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        #{order.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <Badge variant={statusVariant(order.status)}>
                      {order.status}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-soft">
                        Customer
                      </p>
                      <p className="font-medium text-ink">
                        {customer.full_name || "—"}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {customer.phone || customer.email || "No contact info"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-soft">
                        Design
                      </p>
                      <p className="font-medium text-ink">
                        {orderDesignLabel(order)}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {orderDesignSub(order)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-ink-soft">
                          Amount
                        </p>
                        <p className="font-semibold text-ink tabular-nums">
                          {formatMoney(order.amount)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-soft">
                        Payment Ref
                      </p>
                      <code className="mt-1 inline-block text-[11px] text-ink-soft bg-sand px-2 py-1 rounded-md break-all">
                        {order.razorpay_order_id || "—"}
                      </code>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}
    </div>
  );
}
