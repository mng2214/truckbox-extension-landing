/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useState } from "react";
import { Plus } from "lucide-react";

export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="tbp-faq">
      {items.map((item, index) => {
        const open = openIndex === index;
        const answerId = `tbp-faq-answer-${index}`;
        return (
          <div key={item.question} className={"tbp-faq-item" + (open ? " is-open" : "")}>
            <h3>
              <button type="button" aria-expanded={open} aria-controls={answerId} onClick={() => setOpenIndex(open ? null : index)}>
                <span className="tbp-faq-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="tbp-faq-question">{item.question}</span>
                <span className="tbp-faq-toggle" aria-hidden>
                  <Plus />
                </span>
              </button>
            </h3>
            <div id={answerId} className="tbp-faq-answer" role="region" aria-label={item.question} aria-hidden={!open}>
              <div>
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
