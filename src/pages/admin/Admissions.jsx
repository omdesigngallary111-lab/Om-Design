import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../../components/Seo.jsx";
import Pagination from "../../components/Pagination.jsx";
import PageHeader from "../../components/admin/PageHeader.jsx";
import SearchBar from "../../components/admin/SearchBar.jsx";
import Badge from "../../components/admin/Badge.jsx";
import EmptyState from "../../components/admin/EmptyState.jsx";
import Alert from "../../components/admin/Alert.jsx";
import { AdminTable } from "../../components/admin/AdminTable.jsx";
import { TableSkeleton } from "../../components/admin/Skeleton.jsx";
import { IconFile } from "../../components/admin/icons.jsx";
import DateRangeFilterPopover, {
  DateRangeFilterChips,
} from "../../components/admin/DateRangeFilterPopover.jsx";
import {
  fetchAllAdmissions,
  fetchAdmissionStatusCounts,
} from "../../lib/admin.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";

function formatDay(value) {
  if (!value) return "—";
  const raw = String(value);
  const date = raw.length <= 10 ? new Date(`${raw}T00:00:00`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusVariant(status) {
  if (status === "pending") return "pending";
  if (status === "reviewed") return "reviewed";
  if (status === "enrolled") return "enrolled";
  if (status === "rejected") return "rejected";
  return "draft";
}

const tableColumns = [
  { key: "form_number", label: "Form #" },
  { key: "student", label: "Student" },
  { key: "mobile", label: "Mobile" },
  { key: "submitted", label: "Created" },
  { key: "join_date", label: "Join date" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", align: "right" },
];

const emptyDates = {
  createdFrom: "",
  createdTo: "",
  joinFrom: "",
  joinTo: "",
};

export default function Admissions() {
  const [admissions, setAdmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    pending: 0,
    reviewed: 0,
    enrolled: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dates, setDates] = useState(emptyDates);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const debouncedQuery = useDebouncedValue(query);

  const hasDateFilters = Boolean(
    dates.createdFrom ||
      dates.createdTo ||
      dates.joinFrom ||
      dates.joinTo,
  );
  const hasFilters =
    Boolean(debouncedQuery.trim()) ||
    statusFilter !== "all" ||
    hasDateFilters;

  useEffect(() => {
    fetchAdmissionStatusCounts(dates).then(({ counts, error: err }) => {
      if (!err && counts) setStatusCounts(counts);
    });
  }, [dates]);

  useEffect(() => {
    setLoading(true);
    fetchAllAdmissions({
      page,
      pageSize,
      query: debouncedQuery,
      status: statusFilter,
      ...dates,
    }).then(({ admissions: rows, total: t, error: err }) => {
      setAdmissions(rows);
      setTotal(t);
      setError(err ?? "");
      setLoading(false);
    });
  }, [page, pageSize, debouncedQuery, statusFilter, dates]);

  const statusFilters = useMemo(
    () => [
      { value: "all", label: `All (${statusCounts.all})` },
      { value: "pending", label: `Pending (${statusCounts.pending})` },
      { value: "reviewed", label: `Reviewed (${statusCounts.reviewed})` },
      { value: "enrolled", label: `Enrolled (${statusCounts.enrolled})` },
      { value: "rejected", label: `Rejected (${statusCounts.rejected})` },
    ],
    [statusCounts],
  );

  const description =
    statusCounts.all === 0 && !hasFilters
      ? "Create a new admission when a student enrolls in class."
      : `${total} admission${total === 1 ? "" : "s"} shown${hasFilters ? " (filtered)" : ""}.`;

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  const patchDates = (patch) => {
    setDates((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const clearDateFilters = () => {
    setDates(emptyDates);
    setPage(1);
  };

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    clearDateFilters();
  };

  return (
    <div>
      <Seo title="Admissions" noIndex />
      <PageHeader
        title="Admissions"
        description={description}
        action={
          <Link
            to="/admin/admissions/new"
            className="btn-primary !text-xs !py-2.5"
          >
            New Admission
          </Link>
        }
      />

      {error && <Alert>{error}</Alert>}

      <SearchBar
        value={query}
        onChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder="Search form #, name, mobile…"
        filters={statusFilters}
        activeFilter={statusFilter}
        onFilter={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        actions={
          <DateRangeFilterPopover
            createdFrom={dates.createdFrom}
            createdTo={dates.createdTo}
            joinFrom={dates.joinFrom}
            joinTo={dates.joinTo}
            onChange={patchDates}
            onClear={clearDateFilters}
          />
        }
      />

      <DateRangeFilterChips
        createdFrom={dates.createdFrom}
        createdTo={dates.createdTo}
        joinFrom={dates.joinFrom}
        joinTo={dates.joinTo}
        onChange={patchDates}
      />

      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : total === 0 && !hasFilters ? (
        <div className="admin-card">
          <EmptyState
            icon={<IconFile className="w-7 h-7" />}
            title="No admissions yet"
            description="Use New admission to register a student and generate their form PDF."
            action={
              <Link
                to="/admin/admissions/new"
                className="btn-primary !text-xs !py-2"
              >
                New admission
              </Link>
            }
          />
        </div>
      ) : total === 0 ? (
        <div className="admin-card">
          <EmptyState
            icon={<IconFile className="w-7 h-7" />}
            title="No matching applications"
            description="Try a different search, status, or date range."
            action={
              <button
                type="button"
                className="btn-secondary !text-xs !py-2"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <>
          <AdminTable columns={tableColumns}>
            {admissions.map((row) => (
              <tr
                key={row.id}
                className="border-b border-ink/5 hover:bg-sand/40 transition-colors"
              >
                <td className="px-4 py-3.5 text-sm font-bold tabular-nums text-maroon">
                  {row.form_number ?? "—"}
                </td>
                <td className="px-4 py-3.5">
                  <Link
                    to={`/admin/admissions/${row.id}`}
                    className="text-sm font-semibold text-ink hover:text-maroon transition-colors"
                  >
                    {row.student_name}
                  </Link>
                  {row.preferred_language && (
                    <span className="block text-[11px] text-ink-soft mt-0.5 uppercase tracking-wide">
                      {row.preferred_language === "en" ? "English" : "ગુજરાતી"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-sm tabular-nums">
                  {row.student_mobile}
                </td>
                <td className="px-4 py-3.5 text-sm text-ink-soft">
                  {formatDay(row.created_at || row.submitted_at)}
                </td>
                <td className="px-4 py-3.5 text-sm text-ink-soft">
                  {formatDay(row.join_date)}
                </td>
                <td className="px-4 py-3.5">
                  <Badge variant={statusVariant(row.status)}>
                    {row.status}
                  </Badge>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="inline-flex items-center gap-3 justify-end">
                    <Link
                      to={`/admin/admissions/${row.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-maroon hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>

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
