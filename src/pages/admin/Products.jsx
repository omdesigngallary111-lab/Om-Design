import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import Modal from "../../components/Modal.jsx";
import Seo from "../../components/Seo.jsx";
import Pagination from "../../components/Pagination.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAdminFormModal } from "../../hooks/useAdminFormModal.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { slugify } from "../../lib/slugify.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination.js";
import { fetchCategories, FILE_FORMATS } from "../../lib/catalog.js";
import {
  fetchAllDesigns,
  fetchAllSubcategories,
  fetchAllDesignTypes,
  fetchAllDesignAreas,
  fetchAllDesignNeedles,
  createDesign,
  updateDesign,
  deleteDesign,
  uploadProductImage,
  uploadDesignFile,
} from "../../lib/admin.js";

import PageHeader from "../../components/admin/PageHeader.jsx";
import SearchBar from "../../components/admin/SearchBar.jsx";
import Badge from "../../components/admin/Badge.jsx";
import EmptyState from "../../components/admin/EmptyState.jsx";
import Alert from "../../components/admin/Alert.jsx";
import ConfirmDialog from "../../components/admin/ConfirmDialog.jsx";
import FileDropzone from "../../components/admin/FileDropzone.jsx";
import ImagePreviewModal, {
  PreviewThumb,
} from "../../components/admin/ImagePreviewModal.jsx";
import {
  Field,
  Toggle,
  FormSection,
} from "../../components/admin/FormControls.jsx";
import {
  AdminTable,
  ActionsCell,
  RowActions,
} from "../../components/admin/AdminTable.jsx";
import { TableSkeleton } from "../../components/admin/Skeleton.jsx";
import {
  IconPlus,
  IconPackage,
  IconImage,
} from "../../components/admin/icons.jsx";

const RichTextEditor = lazy(
  () => import("../../components/admin/RichTextEditor.jsx"),
);

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  price: "",
  category_id: "",
  subcategory_id: "",
  design_type_id: "",
  file_format: FILE_FORMATS[0],
  area_id: "",
  needle_id: "",
  tags: "",
  is_featured: false,
  is_active: true,
  thumbnail_url: "",
  design_file_url: "",
  design_id: "",
};

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
];

const tableColumns = [
  { key: "designId", label: "Design ID" },
  { key: "product", label: "Product" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price" },
  { key: "format", label: "Format" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", align: "right" },
];

export default function Products() {
  const { showToast } = useToast();
  const [designs, setDesigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [designTypes, setDesignTypes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [needles, setNeedles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const debouncedQuery = useDebouncedValue(query);

  const {
    modalOpen,
    closeModal,
    openCreate,
    openEdit: openEditModal,
    editingId,
    form,
    setForm,
    slugTouched,
    setSlugTouched,
    fieldErrors,
    setFieldErrors,
  } = useAdminFormModal("products", { emptyForm });

  const [saving, setSaving] = useState(false);

  const [imageUploading, setImageUploading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = () => {
    setLoading(true);
    fetchAllDesigns({
      page,
      pageSize,
      query: debouncedQuery,
      status: statusFilter,
    }).then(({ designs: d, total: t, error: err }) => {
      setDesigns(d);
      setTotal(t);
      setError(err ?? "");
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchCategories().then(({ categories: c }) => setCategories(c));
    fetchAllSubcategories().then(({ subcategories: s }) => setSubcategories(s));
    fetchAllDesignTypes().then(({ designTypes: t }) => setDesignTypes(t));
    fetchAllDesignAreas().then(({ areas: a }) => setAreas(a));
    fetchAllDesignNeedles().then(({ needles: n }) => setNeedles(n));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when page params change
  }, [page, pageSize, debouncedQuery, statusFilter]);

  const hasFilters = Boolean(debouncedQuery.trim()) || statusFilter !== "all";

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  const subcatsForCategory = useMemo(
    () => subcategories.filter((s) => s.category_id === form.category_id),
    [subcategories, form.category_id],
  );

  // Active types for new selection; keep the currently chosen type even if inactive
  const designTypeOptions = useMemo(() => {
    const selectedId = form.design_type_id;
    return designTypes.filter((t) => t.is_active || t.id === selectedId);
  }, [designTypes, form.design_type_id]);

  const areaOptions = useMemo(() => {
    const selectedId = form.area_id;
    return areas.filter((a) => a.is_active || a.id === selectedId);
  }, [areas, form.area_id]);

  const needleOptions = useMemo(() => {
    const selectedId = form.needle_id;
    return needles.filter((n) => n.is_active || n.id === selectedId);
  }, [needles, form.needle_id]);

  const openEdit = (d) => {
    openEditModal(
      d.id,
      {
        name: d.name,
        slug: d.slug,
        description: d.description ?? "",
        price: d.price ?? "",
        category_id: d.category_id ?? "",
        subcategory_id: d.subcategory_id ?? "",
        design_type_id: d.design_type_id ?? "",
        file_format: d.file_format ?? FILE_FORMATS[0],
        area_id: d.area_id ?? "",
        needle_id: d.needle_id ?? "",
        tags: (d.tags ?? []).join(", "),
        is_featured: !!d.is_featured,
        is_active: d.is_active !== false,
        thumbnail_url: d.thumbnail_url ?? "",
        design_file_url: d.design_file_url ?? "",
        design_id: d.design_id ?? "",
      },
      { slugTouched: true },
    );
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((f) => ({
      ...f,
      name,
      slug: slugTouched ? f.slug : slugify(name),
    }));
    if (fieldErrors.name)
      setFieldErrors((err) => ({ ...err, name: undefined }));
  };

  const handleCategoryChange = (categoryId) => {
    setForm((f) => ({
      ...f,
      category_id: categoryId,
      subcategory_id:
        f.subcategory_id &&
        subcategories.some(
          (s) => s.id === f.subcategory_id && s.category_id === categoryId,
        )
          ? f.subcategory_id
          : "",
    }));
  };

  const handleSubcategoryChange = (subcategoryId) => {
    const sub = subcategories.find((s) => s.id === subcategoryId);
    setForm((f) => ({
      ...f,
      subcategory_id: subcategoryId,
      category_id: sub?.category_id ?? f.category_id,
    }));
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setImageUploading(true);
    const { url, error: err } = await uploadProductImage(file);
    setImageUploading(false);
    if (err) {
      setError(err);
      showToast(err, { type: "error" });
      return;
    }
    setForm((f) => ({ ...f, thumbnail_url: url }));
  };

  const handleDesignFileUpload = async (file) => {
    if (!file) return;
    setFileUploading(true);
    const { path, error: err } = await uploadDesignFile(file);
    setFileUploading(false);
    if (err) {
      setError(err);
      showToast(err, { type: "error" });
      return;
    }
    setForm((f) => ({ ...f, design_file_url: path }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.slug.trim()) next.slug = "Slug is required";
    if (form.price === "" || Number.isNaN(Number(form.price)))
      next.price = "Enter a valid price";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setError("");
    const payload = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      description: form.description,
      price: Number(form.price) || 0,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      design_type_id: form.design_type_id || null,
      file_format: form.file_format,
      area_id: form.area_id || null,
      needle_id: form.needle_id || null,
      area: areas.find((a) => a.id === form.area_id)?.name ?? null,
      needle: needles.find((n) => n.id === form.needle_id)?.name ?? null,
      tags: form.tags
        ? form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      is_featured: form.is_featured,
      is_active: form.is_active,
      thumbnail_url: form.thumbnail_url || null,
      design_file_url: form.design_file_url || null,
    };
    const { error: err } = editingId
      ? await updateDesign(editingId, payload)
      : await createDesign(payload);
    setSaving(false);
    if (err) {
      setError(err);
      showToast(err, { type: "error" });
      return;
    }
    closeModal();
    showToast(editingId ? "Product updated." : "Product created.", {
      type: "success",
    });
    load();
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error: err } = await deleteDesign(pendingDelete.id);
    setDeleting(false);
    if (err) {
      setError(err);
      showToast(err, { type: "error" });
    } else {
      showToast("Product deleted.", { type: "info" });
      load();
    }
    setPendingDelete(null);
  };

  const designFileName = form.design_file_url
    ? String(form.design_file_url).split("/").pop()
    : "";

  return (
    <div>
      <Seo title="Products" noIndex />
      <PageHeader
        title="Products"
        description={`${total} design${total === 1 ? "" : "s"} in the catalogue.`}
        action={
          <button onClick={openCreate} className="btn-admin">
            <IconPlus className="w-4 h-4" />
            Add Product
          </button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <SearchBar
        value={query}
        onChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder="Search by ID, name, or slug…"
        filters={STATUS_FILTERS}
        activeFilter={statusFilter}
        onFilter={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : total === 0 && !hasFilters ? (
        <div className="admin-card">
          <EmptyState
            icon={<IconPackage className="w-7 h-7" />}
            title="No products yet"
            description="Add your first embroidery design to start building the catalogue."
            action={
              <button onClick={openCreate} className="btn-admin">
                <IconPlus className="w-4 h-4" />
                Add Product
              </button>
            }
          />
        </div>
      ) : total === 0 ? (
        <div className="admin-card">
          <EmptyState
            icon={<IconPackage className="w-7 h-7" />}
            title="No matches"
            description="Try a different search or clear the status filter."
          />
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <AdminTable columns={tableColumns}>
              {designs.map((d) => (
                <tr
                  key={d.id}
                  className="group hover:bg-sand/40 transition-colors duration-150"
                >
                  <td className="px-5 py-3 whitespace-nowrap">
                    <code className="text-xs font-semibold tabular-nums bg-sand px-2 py-0.5 rounded-md">
                      {d.design_id || "—"}
                    </code>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <PreviewThumb
                        src={d.thumbnail_url}
                        alt={d.name}
                        onPreview={() =>
                          setPreview({
                            src: d.thumbnail_url,
                            title: d.name,
                            description: d.design_id
                              ? `Design ID ${d.design_id}`
                              : undefined,
                          })
                        }
                        emptyIcon={<IconImage className="w-4 h-4" />}
                      />
                      {/* Soft cap so long names don't force a huge scroll; full text in title + edit modal */}
                      <div className="min-w-0 max-w-[16rem]" title={d.name}>
                        <p className="font-semibold text-ink truncate">
                          {d.name}
                        </p>
                        <p className="text-xs text-ink-soft truncate">
                          {d.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-soft">
                    <div className="max-w-[10rem]">
                      <span className="block truncate">
                        {d.categories?.name ?? "—"}
                      </span>
                      {d.subcategories?.name && (
                        <span className="block text-xs text-ink-soft/70 truncate">
                          {d.subcategories.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink tabular-nums whitespace-nowrap">
                    ₹{d.price}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <Badge variant="format">{d.file_format}</Badge>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={d.is_active ? "active" : "draft"}>
                        {d.is_active ? "Active" : "Draft"}
                      </Badge>
                      {d.is_featured && (
                        <Badge variant="featured">Featured</Badge>
                      )}
                    </div>
                  </td>
                  <ActionsCell>
                    <RowActions
                      onEdit={() => openEdit(d)}
                      onDelete={() => setPendingDelete(d)}
                    />
                  </ActionsCell>
                </tr>
              ))}
            </AdminTable>
          </div>

          <div className="md:hidden space-y-3">
            {designs.map((d) => (
              <article key={d.id} className="admin-card p-4">
                <div className="flex gap-3">
                  <PreviewThumb
                    src={d.thumbnail_url}
                    alt={d.name}
                    className="w-14 h-14"
                    onPreview={() =>
                      setPreview({
                        src: d.thumbnail_url,
                        title: d.name,
                        description: d.design_id
                          ? `Design ID ${d.design_id}`
                          : undefined,
                      })
                    }
                    emptyIcon={<IconImage className="w-5 h-5" />}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">{d.name}</p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {d.design_id ? `#${d.design_id} · ` : ""}
                      {d.categories?.name ?? "Uncategorised"}
                      {d.subcategories?.name
                        ? ` · ${d.subcategories.name}`
                        : ""}{" "}
                      · ₹{d.price}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant={d.is_active ? "active" : "draft"}>
                        {d.is_active ? "Active" : "Draft"}
                      </Badge>
                      <Badge variant="format">{d.file_format}</Badge>
                    </div>
                  </div>
                  <RowActions
                    onEdit={() => openEdit(d)}
                    onDelete={() => setPendingDelete(d)}
                  />
                </div>
              </article>
            ))}
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

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? "Edit Product" : "Add Product"}
        description={
          editingId
            ? "Update catalogue details, media, and visibility."
            : "Add a design to the catalogue. Fields marked required must be filled in."
        }
        size="xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              className="btn-ghost"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="product-form"
              disabled={saving || imageUploading || fileUploading}
              className="btn-admin"
            >
              {saving ? "Saving…" : "Save Product"}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="space-y-7">
          <FormSection
            title="Media"
            description="Images are public; design files stay in the private bucket."
          >
            <FileDropzone
              kind="image"
              accept="image/*"
              label="Product image"
              hint="JPG, PNG, or WebP"
              uploading={imageUploading}
              previewUrl={form.thumbnail_url}
              fileLabel={form.thumbnail_url ? "Image attached" : ""}
              onFile={handleImageUpload}
              disabled={saving}
            />
            <FileDropzone
              kind="file"
              label="Design file"
              hint="DST / EMB / DHE / DHP — stored privately"
              uploading={fileUploading}
              fileLabel={designFileName}
              onFile={handleDesignFileUpload}
              disabled={saving}
            />
          </FormSection>

          <FormSection title="Basic information">
            {editingId && form.design_id && (
              <Field
                label="Design ID"
                htmlFor="product-design-id"
                hint="Auto-generated when the product was created. Cannot be changed."
              >
                <input
                  id="product-design-id"
                  value={form.design_id}
                  readOnly
                  className="admin-input bg-sand/60 text-ink tabular-nums font-semibold cursor-default"
                />
              </Field>
            )}
            {!editingId && (
              <p className="text-xs text-ink-soft -mt-1 mb-1">
                A unique 6-digit Design ID will be assigned automatically on
                save.
              </p>
            )}
            <Field label="Name" htmlFor="product-name" error={fieldErrors.name}>
              <input
                id="product-name"
                value={form.name}
                onChange={handleNameChange}
                className="admin-input"
              />
            </Field>
            <Field
              label="Slug"
              htmlFor="product-slug"
              error={fieldErrors.slug}
              hint="Used in the public URL."
            >
              <input
                id="product-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value }));
                  if (fieldErrors.slug)
                    setFieldErrors((err) => ({ ...err, slug: undefined }));
                }}
                className="admin-input"
              />
            </Field>
            <Field
              label="Description"
              htmlFor="product-desc"
              hint="Rich text — formatting is preserved on the product page."
            >
              <Suspense
                fallback={
                  <div className="h-40 rounded-xl border border-ink/10 bg-sand/40 animate-pulse" />
                }
              >
                <RichTextEditor
                  value={form.description}
                  onChange={(html) =>
                    setForm((f) => ({ ...f, description: html }))
                  }
                />
              </Suspense>
            </Field>
          </FormSection>

          <FormSection title="Pricing & organisation">
            <div className="grid sm:grid-cols-1 gap-4">
              <Field label="Category" htmlFor="product-category">
                <select
                  id="product-category"
                  value={form.category_id}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="admin-select"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Subcategory"
                htmlFor="product-subcategory"
                hint={form.category_id ? undefined : "Select a category first."}
              >
                <select
                  id="product-subcategory"
                  value={form.subcategory_id}
                  onChange={(e) => handleSubcategoryChange(e.target.value)}
                  className="admin-select"
                  disabled={!form.category_id}
                >
                  <option value="">None</option>
                  {subcatsForCategory.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="Design type"
              htmlFor="product-design-type"
              hint="Optional. Inactive types stay available if already assigned."
            >
              <select
                id="product-design-type"
                value={form.design_type_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, design_type_id: e.target.value }))
                }
                className="admin-select"
              >
                <option value="">None</option>
                {designTypeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {!t.is_active ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid sm:grid-cols-1 gap-4">
              <Field
                label="Price (₹)"
                htmlFor="product-price"
                error={fieldErrors.price}
              >
                <input
                  id="product-price"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, price: e.target.value }));
                    if (fieldErrors.price)
                      setFieldErrors((err) => ({ ...err, price: undefined }));
                  }}
                  className="admin-input"
                />
              </Field>
              <Field label="Format" htmlFor="product-format">
                <select
                  id="product-format"
                  value={form.file_format}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, file_format: e.target.value }))
                  }
                  className="admin-select"
                >
                  {FILE_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Area" htmlFor="product-area">
                <select
                  id="product-area"
                  value={form.area_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, area_id: e.target.value }))
                  }
                  className="admin-select"
                >
                  <option value="">Select area</option>
                  {areaOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Needle" htmlFor="product-needle">
                <select
                  id="product-needle"
                  value={form.needle_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, needle_id: e.target.value }))
                  }
                  className="admin-select"
                >
                  <option value="">Select needle</option>
                  {needleOptions.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="Tags"
              htmlFor="product-tags"
              hint="Comma separated, e.g. floral, border, festive"
            >
              <input
                id="product-tags"
                value={form.tags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
                className="admin-input"
              />
            </Field>
          </FormSection>

          <FormSection title="Visibility">
            <div className="grid sm:grid-cols-2 gap-5">
              <Toggle
                checked={form.is_featured}
                onChange={(v) => setForm((f) => ({ ...f, is_featured: v }))}
                label="Featured"
                description="Highlight this design on the storefront."
              />
              <Toggle
                checked={form.is_active}
                onChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                label="Active"
                description="Visible in the public catalogue."
              />
            </div>
          </FormSection>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => !deleting && setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete product"
        description={
          pendingDelete
            ? `Delete “${pendingDelete.name}”? This can’t be undone.`
            : ""
        }
        confirmLabel="Delete product"
      />

      <ImagePreviewModal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        src={preview?.src}
        title={preview?.title}
        description={preview?.description}
        alt={preview?.title}
      />
    </div>
  );
}
