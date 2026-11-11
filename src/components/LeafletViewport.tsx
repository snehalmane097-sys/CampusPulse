"use client";
import { useEffect, useRef, useState, ReactNode } from "react";
import { Map as LeafletMap } from "leaflet";
import { LeafletProvider, createLeafletContext } from "@react-leaflet/core";
import { CAMPUS_CENTER } from "@/lib/campusMap";
import { ownMap } from "@/lib/mapLifecycle";

// React Leaflet 4's ref initializer is not safe with App Router's React 19 ref replay.
// Only container ownership is replaced; all layers/events still use React Leaflet.
export default function LeafletViewport({children}:{children:ReactNode}) {
  const node=useRef<HTMLDivElement>(null);
  const [context,setContext]=useState<ReturnType<typeof createLeafletContext>|null>(null);
  useEffect(()=>ownMap(()=>new LeafletMap(node.current!,{center:CAMPUS_CENTER,zoom:17,scrollWheelZoom:false}),map=>setContext(createLeafletContext(map))),[]);
  return <div ref={node} className="h-full w-full" aria-label="Interactive VIT Bibwewadi campus map">{context && <LeafletProvider value={context}>{children}</LeafletProvider>}</div>;
}
