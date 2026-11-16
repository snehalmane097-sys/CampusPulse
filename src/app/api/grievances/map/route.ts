import { NextRequest, NextResponse } from "next/server";
import Grievance from "@/models/Grievance";
import { authenticate, fail, pagination, ApiError, id } from "@/lib/api";
import { buildingReportFilter } from "@/lib/buildings";
import { withVerifiedOrigins } from "@/services/complaintOrigin";
import { inSelectionArea } from "@/lib/campusMap";
export async function GET(req:NextRequest) {
  try {
    const actor=await authenticate(req),page=pagination(req,200);
    let filters; try { filters=buildingReportFilter(req.nextUrl.searchParams); } catch(error:any) { throw new ApiError(400,error.message); }
    const building=req.nextUrl.searchParams.get("buildingId");
    const rows=await Grievance.find({...page.filter,...filters,...(building?{building:id(building)}:{}),...(actor.role==="admin"?{}:{student:actor.userId})}).select("_id rawText category location priorityLabel status createdAt isAnonymous incident mapLocation building originDepartment").sort({_id:-1}).limit(page.limit+1).lean();
    const more=rows.length>page.limit;if(more)rows.pop();
    // Explicit allowlist: no student, history actors, attachments or private evidence metadata.
    const reports=(await withVerifiedOrigins(rows)).map(g=>({_id:g._id,rawText:g.rawText.slice(0,500),category:g.category,location:g.location,priorityLabel:g.priorityLabel,status:g.status,createdAt:g.createdAt,isAnonymous:g.isAnonymous,incident:g.incident,building:g.building,origin:g.origin,mapLocation:g.mapLocation&&inSelectionArea(g.mapLocation.lat,g.mapLocation.lng)?{lat:g.mapLocation.lat,lng:g.mapLocation.lng,source:g.mapLocation.source==="osm-feature"?"osm-feature":"user-selected"}:undefined}));
    return NextResponse.json({reports,nextCursor:more?String(rows.at(-1)!._id):null},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error){return fail(error);}
}
export const dynamic="force-dynamic";
