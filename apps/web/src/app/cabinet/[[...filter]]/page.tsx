"use client"

import dynamic from "next/dynamic"
import { CabinetSkeleton } from "../components/cabinet-skeleton"

const CabinetDashboard = dynamic(
  () => import("../cabinet-dashboard").then((module) => module.CabinetDashboard),
  {
    ssr: false,
    loading: () => <CabinetSkeleton />,
  }
)

export default function CabinetPage() {
  return <CabinetDashboard />
}
