import {
  ADMISSION_COMPANY,
  formCopy,
  rules,
  stampText,
} from "../../lib/i18n/admissionTranslations.js";
import { LOGO_SRC } from "../../data/studio.js";
import FormNumberValue from "./FormNumberValue.jsx";
import AadhaarFitImage from "./AadhaarFitImage.jsx";
import "./admission-print.css";

const GU_DIGITS = ["૦", "૧", "૨", "૩", "૪", "૫", "૬", "૭", "૮", "૯"];

function toGuNumber(n) {
  return String(n)
    .split("")
    .map((d) => GU_DIGITS[Number(d)] ?? d)
    .join("");
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function installmentColumns(installments) {
  if (installments?.length > 0) return installments;
  return Array.from({ length: 4 }, () => ({}));
}

function computeTotal(installments) {
  return installments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function FeeTable({ installments, labels, tableClass = "fee-table" }) {
  const cols = installmentColumns(installments);
  const total = computeTotal(installments);

  return (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>{labels.date}</th>
          {cols.map((row, i) => (
            <th key={row.id ?? `d-${i}`}>{formatDate(row.installment_date)}</th>
          ))}
          <th>{labels.total}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="row-label">{labels.installmentAmount}</td>
          {cols.map((row, i) => (
            <td key={`a-${row.id ?? i}`}>{formatAmount(row.amount)}</td>
          ))}
          <td>{total > 0 ? formatAmount(total) : ""}</td>
        </tr>
        <tr>
          <td className="row-label">{labels.installmentReceived}</td>
          {cols.map((row, i) => (
            <td key={`s-${row.id ?? i}`}>{row.received_by ?? ""}</td>
          ))}
          <td />
        </tr>
      </tbody>
    </table>
  );
}

function FormBrandHeader({ formNumber, address }) {
  return (
    <div className="company-header">
      <div className="header-left" aria-hidden="true">
        <img
          src={LOGO_SRC}
          alt=""
          className="company-logo"
          crossOrigin="anonymous"
        />
      </div>
      <div className="header-content">
        <div className="company-name">{ADMISSION_COMPANY.name}</div>
        <div className="company-address">{address}</div>
        <div className="company-mobile">
          {ADMISSION_COMPANY.mobiles.map((m) => (
            <span key={m.number} className="company-mobile-item">
              Mo. {m.number} ({m.label})
            </span>
          ))}
        </div>
      </div>
      <div className="form-number-box">
        <div className="form-number-label">Form No</div>
        <FormNumberValue
          value={formNumber}
          className="form-number-value-canvas"
          width={112}
          height={44}
          fontSize={28}
        />
      </div>
    </div>
  );
}

function PrintPageHeader({ formNumber, address }) {
  return (
    <div className="print-header">
      <FormBrandHeader formNumber={formNumber} address={address} />
      <div className="form-title-bar">
        <span className="form-title-en">{formCopy.en.print.admissionForm}</span>
        <span className="form-title-gu">{formCopy.gu.print.admissionForm}</span>
      </div>
    </div>
  );
}

/**
 * Two-page admission PDF template — proportions match the physical paper form.
 * Page 1: office form + tear-off student copy
 * Page 2: rules + tear-off fee strip (same height as student copy)
 */
export default function AdmissionPrintDocument({
  admission,
  installments = [],
  language = "gu",
  photoUrl,
  aadhaarUrls = [],
  signatureUrl,
}) {
  const lang = language === "en" ? "en" : "gu";
  const t = formCopy[lang].print;
  const f = formCopy[lang];
  const ruleList = rules[lang];
  const address =
    lang === "gu" ? ADMISSION_COMPANY.addressGu : ADMISSION_COMPANY.addressEn;
  const formNumber = admission?.form_number ?? "";

  const startParts = String(admission?.class_start_time ?? "")
    .split(/[:\s]/)
    .filter(Boolean);
  const endParts = String(admission?.class_end_time ?? "")
    .split(/[:\s]/)
    .filter(Boolean);
  const aadhaarImages = Array.isArray(aadhaarUrls) ? aadhaarUrls.filter(Boolean).slice(0, 2) : [];

  return (
    <div className="admission-print-root">
      {/* PAGE 1 — student details + student copy */}
      <div className="page page-1">
        <PrintPageHeader formNumber={formNumber} address={address} />

        <div className="admission-container">
          <div className="admission-background" aria-hidden="true">
            <img src={LOGO_SRC} alt="" crossOrigin="anonymous" />
          </div>

          <div className="photo-box">
            {photoUrl ? (
              <img src={photoUrl} alt="" crossOrigin="anonymous" />
            ) : (
              <div className="photo-placeholder">{t.photo}</div>
            )}
          </div>

          <div className="admission-fields">
            <div className="field-row student-name-row">
              <div className="field-label">{f.studentName}</div>
              <div className="field-line">{admission?.student_name ?? ""}</div>
            </div>

            <div className="field-row mobile-row">
              <div className="field-label">{f.studentMobile}</div>
              <div className="field-line">
                {admission?.student_mobile ?? ""}
              </div>
            </div>

            <div className="field-row father-row">
              <div className="field-label">{f.fatherMobile}</div>
              <div className="field-line">{admission?.father_mobile ?? ""}</div>
            </div>

            <div className="address-block">
              <div className="field-row">
                <div className="field-label">{f.currentAddress}</div>
                <div className="field-line">
                  {admission?.current_address ?? ""}
                </div>
              </div>
              <div className="dotted-line" />
            </div>

            <div className="address-block">
              <div className="field-row">
                <div className="field-label">{f.permanentAddress}</div>
                <div className="field-line">
                  {admission?.permanent_address ?? ""}
                </div>
              </div>
              <div className="dotted-line" />
            </div>

            <div className="reference-row">
              <div className="reference-description">{f.referenceDetails}</div>
              <div className="reference-line">
                {admission?.reference_details ?? ""}
              </div>
              {/* <div className="dotted-line" /> */}
            </div>

            <div className="time-row">
              <div className="field-label">{f.classTime}</div>
              <div className="time-input">{startParts[0] ?? ""}</div>
              <span className="time-colon">:</span>
              <div className="time-input">{startParts[1] ?? ""}</div>
              <span className="time-separator">{t.to}</span>
              <div className="time-input">{endParts[0] ?? ""}</div>
              <span className="time-colon">:</span>
              <div className="time-input">{endParts[1] ?? ""}</div>
              <span className="batch-type-label">{t.batchType}</span>
              <div className="batch-type-input">
                {admission?.batch_type ?? ""}
              </div>
            </div>

            <div className="package-row">
              <div className="package-label">{t.package}</div>
              <div className="package-value">{admission?.package ?? ""}</div>
            </div>
          </div>

          <div className="admission-footer">
            <div className="section-label">{t.feeDetails}</div>
            <FeeTable installments={installments} labels={t} />

            <div className="signature-row">
              <div className="signature-field inline-label">
                <span>{t.studentSignature}</span>
                <div className="signature-line">
                  {signatureUrl ? (
                    <img src={signatureUrl} alt="" crossOrigin="anonymous" />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="cut-line">
          <span className="scissors" aria-hidden="true">
            ✂
          </span>
        </div>

        <div className="student-copy tear-off-band">
          <FormBrandHeader formNumber={formNumber} address={address} />
          <div className="student-copy-body">
            <div className="student-copy-field">
              <div className="student-copy-label">{t.studentCopyName}</div>
              <div className="student-copy-value">
                {admission?.student_name ?? ""}
              </div>
            </div>
            <div className="student-copy-field student-copy-time">
              <div className="student-copy-label">{t.studentCopyTime}</div>
              <div className="student-copy-time-slots">
                <span className="time-input">{startParts[0] ?? ""}</span>
                <span className="time-colon">:</span>
                <span className="time-input">{startParts[1] ?? ""}</span>
                <span className="time-separator">{t.to}</span>
                <span className="time-input">{endParts[0] ?? ""}</span>
                <span className="time-colon">:</span>
                <span className="time-input">{endParts[1] ?? ""}</span>
                <span className="batch-type-label">{t.batchType}</span>
                <span className="batch-type-input">
                  {admission?.batch_type ?? ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 2 — rules + admin fee ledger */}
      <div className="page page-2">
        <div className="rules-page">
          <div className="rules-title">{t.rulesTitle}</div>

          <div className="rules-list">
            {ruleList.map((text, idx) => (
              <div className="rule" key={idx}>
                <div className="rule-number">
                  {lang === "gu" ? toGuNumber(idx + 1) : idx + 1}.
                </div>
                <div className="rule-text">{text}</div>
              </div>
            ))}
          </div>

          <div className="rules-mid">
            <div className="rule-stamp">
              <div>{stampText.gu}</div>
              <div style={{ marginTop: "2mm" }}>{stampText.en}</div>
            </div>
            <div className="rules-signature">
              <div className="signature-field inline-label">
                <span>{t.studentSignature}</span>
                <div className="signature-line">
                  {signatureUrl ? (
                    <img src={signatureUrl} alt="" crossOrigin="anonymous" />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="cut-line">
          <span className="scissors" aria-hidden="true">
            ✂
          </span>
        </div>

        {/* Tear-off band — same height/width as page-1 .student-copy for aligned cutting */}
        <div className="tear-off-band rules-fee-section">
          <div className="rules-fee-title">{t.feeWarning}</div>
          <FeeTable
            installments={installments}
            labels={t}
            tableClass="rules-fee-table"
          />
          <div className="administrator-signature">
            <div className="signature-field inline-label">
              <span>{t.administratorSignature}</span>
              <div className="signature-line" />
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 3 — Aadhaar card images (optional) */}
      {aadhaarImages.length > 0 ? (
        <div className="page page-3">
          <div className="aadhaar-page-body">
            <div
              className={`aadhaar-vertical-stack ${
                aadhaarImages.length === 1 ? "aadhaar-stack-single" : "aadhaar-stack-dual"
              }`}
            >
              {aadhaarImages.map((url, index) => (
                <div
                  className="aadhaar-vertical-card"
                  key={url}
                  aria-label={`Aadhaar card ${index + 1}`}
                >
                  <AadhaarFitImage
                    src={url}
                    alt={`Aadhaar card ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
