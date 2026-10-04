/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { followTrackedLink } from "../lib/attribution";

export default function TrackedLinkPage() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void followTrackedLink(code ?? "").then((target) => {
      if (active) navigate(target, { replace: true });
    });
    return () => {
      active = false;
    };
  }, [code, navigate]);

  return null;
}
