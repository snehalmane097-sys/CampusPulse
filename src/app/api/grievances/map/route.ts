import { NextRequest, NextResponse } from "next/server";
import Grievance from "@/models/Grievance";
import { authenticate, fail, pagination } from "@/lib/api";
import { inSelectionArea } from "@/lib/campusMap";
export async function GET(req:NextRequest) {
  try {
    const actor=await authenticate(req),page=pagination(req,200);
    const rows=await Grievance.find({...page.filter,...(actor.role==="admin"?{}:{student:actor.userId})}).select("_id rawText category location priorityLabel status createdAt isAnonymous incident mapLocation").sort({_id:-1}).limit(page.limit+1).lean();
    const more=rows.length>page.limit;if(more)rows.pop();
    // Explicit allowlist: no student, history actors, attachments or private evidence metadata.
    const reports=rows.map(g=>({_id:g._id,rawText:g.rawText.slice(0,500),category:g.category,location:g.location,priorityLabel:g.priorityLabel,status:g.status,createdAt:g.createdAt,isAnonymous:g.isAnonymous,incident:g.incident,mapLocation:g.mapLocation&&inSelectionArea(g.mapLocation.lat,g.mapLocation.lng)?{lat:g.mapLocation.lat,lng:g.mapLocation.lng,source:g.mapLocation.source==="osm-feature"?"osm-feature":"user-selected"}:undefined}));
    return NextResponse.json({reports,nextCursor:more?String(rows.at(-1)!._id):null},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error){return fail(error);}
}
export const dynamic="force-dynamic";
