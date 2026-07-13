import type { SVGProps } from 'react';

type Props=SVGProps<SVGSVGElement>&{compact?:boolean};

export default function BrandMark({compact=false,className='',...props}:Props){
  return <svg {...props} className={['mark',compact?'mark-compact':'',className].filter(Boolean).join(' ')} viewBox="0 0 32 32" role={props['aria-label']?'img':undefined} aria-hidden={props['aria-label']?undefined:true}>
    <path className="mark-first" d="M5 5h17v5H10v12H5V5Z"/>
    <path className="mark-second" d="M12 12h15v15h-5V17H12v-5Z"/>
  </svg>
}
