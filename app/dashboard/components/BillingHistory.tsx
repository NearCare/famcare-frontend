"use client";

import { Receipt, SpinnerGap } from "@phosphor-icons/react";
import type { BillingInvoice } from "@/lib/api";

const amountFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Receipts, straight from Razorpay. Each row links to Razorpay's own hosted
 * invoice page rather than a receipt we render ourselves — the provider is the
 * authority on what was actually charged.
 *
 * Shared by the payments page and Plans & billing so the two can't drift.
 */
export default function BillingHistory({
  invoices,
  failed,
}: {
  invoices: BillingInvoice[] | null;
  failed: boolean;
}) {
  return (
    <section className="payment-history">
      <h3><Receipt size={18} weight="duotone" /> Billing history</h3>

      {failed ? (
        <p className="payment-history-empty">
          Your billing history could not be loaded right now. Refresh to try again.
        </p>
      ) : invoices === null ? (
        <p className="payment-history-empty">
          <SpinnerGap size={18} className="payment-spin" /> Loading receipts…
        </p>
      ) : invoices.length === 0 ? (
        <p className="payment-history-empty">
          No receipts yet. Your first one appears here once a payment is collected.
        </p>
      ) : (
        <ul className="payment-history-list">
          {invoices.map((invoice) => {
            const when = invoice.paid_at ?? invoice.issued_at;
            return (
              <li key={invoice.id}>
                <div className="payment-history-main">
                  <strong>{invoice.description}</strong>
                  <span>{when ? dateFormatter.format(new Date(when)) : "Date pending"}</span>
                </div>
                <span className={`payment-history-status ${invoice.status === "paid" ? "paid" : "other"}`}>
                  {invoice.status === "paid" ? "Paid" : invoice.status.replace(/_/g, " ")}
                </span>
                <strong className="payment-history-amount">
                  ₹{amountFormatter.format(invoice.amount_paise / 100)}
                </strong>
                {invoice.receipt_url ? (
                  <a
                    className="payment-history-link"
                    href={invoice.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Receipt
                  </a>
                ) : (
                  <span className="payment-history-link disabled">—</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
