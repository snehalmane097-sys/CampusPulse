// Abstract campus-inspired artwork, not a map, floor plan, source geometry or live data.
export default function CampusIllustration() {
  return <div className="relative mt-10 max-w-xl" aria-hidden="true">
    <svg viewBox="0 0 600 310" fill="none" className="w-full h-auto">
      <path d="M40 270h520" stroke="#DDE2EE" strokeWidth="2"/>
      <path d="M100 270V137l105-50 105 50v133" fill="#E7E7F8"/>
      <path d="M100 137l105-50 105 50" stroke="#7D73AE" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M329 270V110h151v160" fill="#FDFCF9" stroke="#DDE2EE" strokeWidth="2"/>
      <path d="M340 110V88h128v22" fill="#DEE2F0"/>
      <path d="M168 270v-52a37 37 0 0 1 74 0v52" fill="#F5F6FA"/>
      {[137,194,251].map(x=><g key={x}><rect x={x} y="153" width="20" height="25" rx="4" fill="#A7A2D3"/><rect x={x} y="196" width="20" height="25" rx="4" fill="#A7A2D3"/></g>)}
      {[354,398,442].map(x=><g key={x}><rect x={x} y="137" width="17" height="26" rx="3" fill="#CBD5E5"/><rect x={x} y="187" width="17" height="26" rx="3" fill="#CBD5E5"/></g>)}
      <circle cx="205" cy="125" r="12" fill="#FFF" stroke="#7D73AE" strokeWidth="2"/><path d="M205 118v8l5 3" stroke="#7D73AE" strokeWidth="2" strokeLinecap="round"/>
      <path d="M62 270v-64m-13 20 13 12 16-20m440 52v-82m-17 24 17 15 18-23" stroke="#7B958E" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="62" cy="195" r="26" fill="#D7E4DC"/><circle cx="518" cy="175" r="32" fill="#D7E4DC"/>
      <path d="M277 288h80m-27-8 10 8-10 8" stroke="#BC6842" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="480" cy="48" r="18" fill="#F1E0D5"/><path d="M75 64h63m-37-13h64" stroke="#DDE2EE" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  </div>;
}
