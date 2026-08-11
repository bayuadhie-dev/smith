import React from 'react';

export type MachineIconType =
  | 'filler'
  | 'wipes_line'
  | 'wash_glove'
  | 'tisu_sheet'
  | 'alcohol_wipes'
  | 'bagmaking'
  | 'banded_pack'
  | 'fliptop'
  | 'slitting'
  | 'cutting'
  | 'perforating'
  | 'laminating'
  | 'folding';

interface IconProps {
  color: string;
  unitCount?: number;
}

// Shared hatch/rivet helpers keep each icon function focused on its own shape.
const Rivets: React.FC<{ points: [number, number][]; color: string }> = ({ points, color }) => (
  <>
    {points.map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r={0.9} fill={color} stroke="none" opacity={0.85} />
    ))}
  </>
);

export const FillerIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <line x1="20" y1="70" x2="120" y2="70" strokeWidth="1.8" />
    <line x1="42" y1="70" x2="42" y2="48" strokeWidth="1.4" />
    <line x1="98" y1="70" x2="98" y2="48" strokeWidth="1.4" />
    <rect x="36" y="44" width="12" height="6" strokeWidth="0.8" />
    <rect x="92" y="44" width="12" height="6" strokeWidth="0.8" />
    <ellipse cx="70" cy="17" rx="40" ry="26" strokeWidth="1.7" />
    <ellipse cx="70" cy="17" rx="36" ry="24.5" strokeWidth="0.6" />
    <ellipse cx="70" cy="17" rx="32" ry="21" strokeWidth="0.35" opacity={0.7} />
    <g strokeWidth="0.4" opacity={0.5}>
      <line x1="35" y1="-18" x2="65" y2="60" /><line x1="45" y1="-22" x2="75" y2="58" />
      <line x1="55" y1="-24" x2="85" y2="55" /><line x1="65" y1="-24" x2="95" y2="50" />
    </g>
    <Rivets color={color} points={[[33,5],[40,-8],[52,-13],[70,-16],[88,-13],[100,-8],[107,5],[107,29],[100,42],[88,47],[70,50],[52,47],[40,42],[33,29]]} />
    <line x1="70" y1="43" x2="70" y2="58" strokeWidth="1.6" />
    <rect x="56" y="58" width="28" height="12" rx="1" strokeWidth="1.2" />
    <line x1="70" y1="70" x2="70" y2="80" strokeWidth="0.8" strokeDasharray="4 3" />
    <path d="M50 80 L50 105 Q50 116 58 116 L82 116 Q90 116 90 105 L90 80 Z" strokeWidth="1.7" />
    <line x1="50" y1="80" x2="90" y2="80" strokeWidth="1.6" />
    <g transform="translate(28,-2)">
      <circle r="7" strokeWidth="1.1" /><circle r="2.5" strokeWidth="0.6" />
      <line x1="-7" y1="0" x2="7" y2="0" strokeWidth="0.5" /><line x1="0" y1="-7" x2="0" y2="7" strokeWidth="0.5" />
    </g>
    <g transform="translate(112,-2)">
      <circle r="7" strokeWidth="1.1" /><circle r="2.5" strokeWidth="0.6" />
      <line x1="-7" y1="0" x2="7" y2="0" strokeWidth="0.5" /><line x1="0" y1="-7" x2="0" y2="7" strokeWidth="0.5" />
    </g>
  </g>
);

export const WipesLineIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <circle cx="26" cy="26" r="24" strokeWidth="1.6" />
    <circle cx="26" cy="26" r="19" strokeWidth="0.5" />
    <circle cx="26" cy="26" r="12" strokeWidth="0.35" opacity={0.7} />
    <g strokeWidth="0.4" opacity={0.45}>
      <line x1="4" y1="8" x2="42" y2="52" /><line x1="10" y1="4" x2="46" y2="48" />
    </g>
    <circle cx="26" cy="26" r="6" strokeWidth="1.1" />
    <line x1="50" y1="26" x2="80" y2="26" strokeWidth="1" />
    <rect x="80" y="4" width="52" height="46" rx="3" strokeWidth="1.6" />
    <rect x="85" y="9" width="42" height="36" rx="2" strokeWidth="0.5" />
    <g strokeWidth="0.4" opacity={0.4}>
      <line x1="80" y1="10" x2="100" y2="50" /><line x1="90" y1="4" x2="110" y2="50" /><line x1="100" y1="4" x2="120" y2="45" />
    </g>
    <line x1="132" y1="26" x2="152" y2="26" strokeWidth="1" />
    <rect x="152" y="12" width="38" height="9" strokeWidth="1.1" />
    <rect x="152" y="23" width="38" height="9" strokeWidth="1.1" />
    <rect x="152" y="34" width="38" height="9" strokeWidth="1.1" />
    <Rivets color={color} points={[[85,9],[127,9],[85,45],[127,45]]} />
  </g>
);

export const WashGloveIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <line x1="-5" y1="105" x2="125" y2="105" strokeWidth="1.8" />
    <line x1="15" y1="105" x2="15" y2="72" strokeWidth="1.4" />
    <line x1="105" y1="105" x2="105" y2="72" strokeWidth="1.4" />
    <rect x="9" y="68" width="12" height="6" strokeWidth="0.8" />
    <rect x="99" y="68" width="12" height="6" strokeWidth="0.8" />
    <rect x="0" y="0" width="120" height="70" rx="4" strokeWidth="1.7" />
    <rect x="6" y="6" width="108" height="58" rx="3" strokeWidth="0.5" />
    <g strokeWidth="0.4" opacity={0.4}>
      <line x1="-5" y1="-10" x2="50" y2="75" /><line x1="10" y1="-15" x2="65" y2="70" /><line x1="25" y1="-18" x2="80" y2="60" />
    </g>
    <rect x="15" y="30" width="70" height="30" rx="2" strokeWidth="1.3" />
    <line x1="15" y1="38" x2="85" y2="38" strokeWidth="0.7" />
    <g strokeWidth="0.35" opacity={0.5}>
      <line x1="15" y1="40" x2="40" y2="60" /><line x1="30" y1="38" x2="55" y2="60" /><line x1="45" y1="38" x2="70" y2="60" />
    </g>
    <path d="M22 38 Q27 35 32 38 Q37 41 42 38" strokeWidth="0.4" opacity={0.6} />
    <rect x="38" y="18" width="18" height="14" rx="1" strokeWidth="1" />
    <circle cx="60" cy="-10" r="9" strokeWidth="1.3" />
    <circle cx="60" cy="-10" r="4" strokeWidth="0.5" />
    <line x1="40" y1="-10" x2="51" y2="-10" strokeWidth="1" />
    <line x1="69" y1="-10" x2="90" y2="-10" strokeWidth="1" />
    <rect x="120" y="15" width="30" height="40" rx="2" strokeWidth="1.4" />
    <line x1="120" y1="28" x2="150" y2="28" strokeWidth="0.4" opacity={0.6} />
    <rect x="155" y="32" width="14" height="12" strokeWidth="0.9" />
    <rect x="158" y="29" width="14" height="12" strokeWidth="0.7" />
    <Rivets color={color} points={[[5,6],[60,3],[115,6],[5,65],[60,67],[115,65]]} />
  </g>
);

export const TisuSheetIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <line x1="-5" y1="100" x2="115" y2="100" strokeWidth="1.8" />
    <line x1="10" y1="100" x2="10" y2="69" strokeWidth="1.3" />
    <line x1="100" y1="100" x2="100" y2="69" strokeWidth="1.3" />
    <rect x="0" y="0" width="110" height="65" rx="4" strokeWidth="1.7" />
    <rect x="6" y="6" width="98" height="53" rx="3" strokeWidth="0.5" />
    <g strokeWidth="0.4" opacity={0.4}>
      <line x1="-5" y1="-10" x2="40" y2="70" /><line x1="15" y1="-15" x2="60" y2="70" /><line x1="35" y1="-18" x2="80" y2="65" />
    </g>
    <rect x="10" y="25" width="60" height="28" rx="2" strokeWidth="1.2" />
    <line x1="10" y1="32" x2="70" y2="32" strokeWidth="0.6" />
    <g strokeWidth="0.35" opacity={0.5}>
      <line x1="10" y1="34" x2="32" y2="53" /><line x1="22" y1="32" x2="44" y2="53" /><line x1="34" y1="32" x2="56" y2="53" />
    </g>
    <path d="M16 32 Q20 29 24 32 Q28 35 32 32" strokeWidth="0.4" opacity={0.6} />
    <circle cx="80" cy="18" r="8" strokeWidth="1.2" />
    <circle cx="80" cy="18" r="3" strokeWidth="0.5" />
    <rect x="73" y="48" width="30" height="14" rx="1" strokeWidth="1.1" />
    <rect x="110" y="45" width="14" height="12" strokeWidth="0.9" />
    <rect x="113" y="42" width="14" height="12" strokeWidth="0.7" />
    <Rivets color={color} points={[[5,6],[55,3],[105,6],[5,59],[105,59]]} />
  </g>
);

export const AlcoholWipesIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <line x1="-5" y1="85" x2="95" y2="85" strokeWidth="1.8" />
    <line x1="10" y1="85" x2="10" y2="59" strokeWidth="1.2" />
    <line x1="80" y1="85" x2="80" y2="59" strokeWidth="1.2" />
    <rect x="0" y="0" width="90" height="55" rx="3" strokeWidth="1.7" />
    <rect x="6" y="6" width="78" height="43" rx="2" strokeWidth="0.5" />
    <g strokeWidth="0.4" opacity={0.4}>
      <line x1="-5" y1="-5" x2="30" y2="58" /><line x1="15" y1="-8" x2="50" y2="55" /><line x1="35" y1="-10" x2="65" y2="48" />
    </g>
    <rect x="15" y="18" width="45" height="22" rx="2" strokeWidth="1.6" />
    <rect x="18" y="21" width="39" height="16" rx="1" strokeWidth="0.9" />
    <rect x="21" y="23.5" width="33" height="11" rx="0.5" strokeWidth="0.5" opacity={0.7} />
    <line x1="15" y1="18" x2="60" y2="18" strokeWidth="1.3" />
    <line x1="15" y1="40" x2="60" y2="40" strokeWidth="1.3" />
    <g strokeWidth="0.3" opacity={0.6}>
      <line x1="20" y1="16" x2="22" y2="20" /><line x1="26" y1="16" x2="28" y2="20" /><line x1="32" y1="16" x2="34" y2="20" />
      <line x1="38" y1="16" x2="40" y2="20" /><line x1="44" y1="16" x2="46" y2="20" /><line x1="50" y1="16" x2="52" y2="20" />
    </g>
    <Rivets color={color} points={[[5,6],[45,3],[85,6],[5,49],[85,49]]} />
  </g>
);

export const BagmakingIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <rect x="-10" y="-15" width="6" height="20" strokeWidth="1" />
    <path d="M-7 5 L-12 20 L-2 20 Z" strokeWidth="1" />
    <line x1="-20" y1="20" x2="80" y2="20" strokeWidth="0.5" opacity={0.6} />
    <path d="M0 0 L60 0 L60 70 Q60 80 50 80 L10 80 Q0 80 0 70 Z" strokeWidth="1.7" />
    <path d="M5 5 L55 5 L55 68 Q55 73 50 73" strokeWidth="0.4" opacity={0.6} />
    <g strokeWidth="0.35" opacity={0.7}>
      <line x1="0" y1="5" x2="0" y2="72" strokeDasharray="2 2" />
      <line x1="60" y1="5" x2="60" y2="72" strokeDasharray="2 2" />
    </g>
    <path d="M8 78 Q30 85 50 78" strokeWidth="0.4" strokeDasharray="2 2" opacity={0.8} />
    <line x1="0" y1="0" x2="60" y2="0" strokeWidth="1.3" />
    <Rivets color={color} points={[[0,15],[0,25],[0,35],[0,45],[0,55],[0,65],[60,15],[60,25],[60,35],[60,45],[60,55],[60,65]]} />
    <line x1="65" y1="40" x2="100" y2="40" strokeWidth="1" />
    <line x1="65" y1="44" x2="90" y2="44" strokeWidth="0.35" strokeDasharray="3 2" opacity={0.5} />
  </g>
);

export const BandedPackIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <line x1="-5" y1="75" x2="95" y2="75" strokeWidth="1.8" />
    <rect x="0" y="0" width="90" height="55" rx="2" strokeWidth="1.7" />
    <rect x="6" y="6" width="78" height="43" strokeWidth="0.5" />
    <g strokeWidth="0.4" opacity={0.4}>
      <line x1="-5" y1="-10" x2="30" y2="60" /><line x1="15" y1="-13" x2="50" y2="57" /><line x1="35" y1="-15" x2="60" y2="50" />
    </g>
    <rect x="15" y="15" width="16" height="26" rx="1" strokeWidth="1.2" />
    <rect x="33" y="15" width="16" height="26" rx="1" strokeWidth="1.2" />
    <rect x="51" y="15" width="16" height="26" rx="1" strokeWidth="1.2" />
    <line x1="12" y1="23" x2="70" y2="23" strokeWidth="2" />
    <line x1="12" y1="33" x2="70" y2="33" strokeWidth="2" />
    <Rivets color={color} points={[[5,6],[45,3],[85,6],[5,49],[85,49]]} />
  </g>
);

export const FliptopIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <rect x="0" y="30" width="60" height="35" rx="2" strokeWidth="1.6" />
    <rect x="4" y="34" width="52" height="27" strokeWidth="0.5" />
    <g strokeWidth="0.3" opacity={0.5}>
      <line x1="4" y1="40" x2="56" y2="40" /><line x1="4" y1="46" x2="56" y2="46" />
      <line x1="4" y1="52" x2="56" y2="52" /><line x1="4" y1="58" x2="56" y2="58" />
    </g>
    <path d="M18 20 L42 20 L42 30 Q42 32 40 32 L20 32 Q18 32 18 30 Z" strokeWidth="1.4" />
    <path d="M22 20 L22 12 Q22 8 26 8 L34 8 Q38 8 38 12 L38 20" strokeWidth="1" />
    <line x1="18" y1="26" x2="42" y2="26" strokeWidth="0.4" opacity={0.6} />
    <line x1="30" y1="-8" x2="30" y2="19" strokeWidth="1" strokeDasharray="2 2" />
    <path d="M25 6 L30 12 L35 6" strokeWidth="1" />
    <Rivets color={color} points={[[5,34],[55,34],[5,61],[55,61]]} />
  </g>
);

export const SlittingIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <line x1="-15" y1="60" x2="145" y2="60" strokeWidth="1.8" />
    <line x1="18" y1="60" x2="18" y2="34" strokeWidth="1.4" />
    <line x1="98" y1="60" x2="98" y2="34" strokeWidth="1.4" />
    <rect x="12" y="29" width="14" height="6" strokeWidth="0.8" />
    <rect x="92" y="29" width="14" height="6" strokeWidth="0.8" />
    <line x1="-15" y1="0" x2="140" y2="0" strokeWidth="2.3" />
    <circle cx="18" cy="0" r="36" strokeWidth="1.7" />
    <circle cx="18" cy="0" r="31" strokeWidth="0.5" />
    <circle cx="18" cy="0" r="26" strokeWidth="0.35" opacity={0.7} />
    <circle cx="98" cy="0" r="36" strokeWidth="1.7" />
    <circle cx="98" cy="0" r="31" strokeWidth="0.5" />
    <circle cx="98" cy="0" r="26" strokeWidth="0.35" opacity={0.7} />
    <g strokeWidth="0.35" opacity={0.4}>
      <line x1="-18" y1="-35" x2="45" y2="35" /><line x1="-25" y1="-18" x2="30" y2="35" />
      <line x1="62" y1="-35" x2="125" y2="35" /><line x1="55" y1="-18" x2="110" y2="35" />
    </g>
    <circle cx="18" cy="0" r="8" strokeWidth="1.3" />
    <circle cx="18" cy="0" r="3" strokeWidth="0.5" />
    <circle cx="98" cy="0" r="8" strokeWidth="1.3" />
    <circle cx="98" cy="0" r="3" strokeWidth="0.5" />
    <Rivets color={color} points={[[18,-34],[18,34],[-14,0],[50,0],[98,-34],[98,34],[66,0],[130,0]]} />
    <line x1="-40" y1="0" x2="-18" y2="0" strokeWidth="1.2" />
    <line x1="134" y1="0" x2="160" y2="0" strokeWidth="1.2" />
  </g>
);

export const CuttingIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <circle cx="35" cy="30" r="26" strokeWidth="1.7" />
    <circle cx="35" cy="30" r="20" strokeWidth="0.5" />
    <circle cx="35" cy="30" r="7" strokeWidth="1" />
    <g strokeWidth="0.35" opacity={0.5}>
      <line x1="20" y1="12" x2="50" y2="48" /><line x1="15" y1="20" x2="45" y2="52" /><line x1="26" y1="8" x2="52" y2="40" />
    </g>
    <line x1="65" y1="4" x2="65" y2="56" strokeWidth="1" />
    <path d="M62 4 L68 4 L65 12 Z" strokeWidth="1" />
    <path d="M62 20 L68 20 L65 28 Z" strokeWidth="1" />
    <path d="M62 36 L68 36 L65 44 Z" strokeWidth="1" />
    <circle cx="95" cy="15" r="10" strokeWidth="1.3" /><circle cx="95" cy="15" r="4" strokeWidth="0.5" />
    <circle cx="95" cy="40" r="14" strokeWidth="1.3" /><circle cx="95" cy="40" r="5" strokeWidth="0.5" />
    <line x1="60" y1="30" x2="80" y2="15" strokeWidth="0.4" strokeDasharray="2 2" />
    <line x1="60" y1="30" x2="80" y2="40" strokeWidth="0.4" strokeDasharray="2 2" />
  </g>
);

export const PerforatingIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <circle cx="30" cy="30" r="22" strokeWidth="1.6" />
    <circle cx="30" cy="30" r="17" strokeWidth="0.5" />
    <circle cx="30" cy="30" r="6" strokeWidth="1" />
    <g strokeWidth="0.3" opacity={0.5}>
      <line x1="15" y1="15" x2="45" y2="45" /><line x1="12" y1="22" x2="38" y2="48" />
    </g>
    <line x1="52" y1="30" x2="70" y2="30" strokeWidth="1" />
    <circle cx="80" cy="30" r="10" strokeWidth="1.3" />
    <g strokeWidth="1" opacity={0.9}>
      <line x1="80" y1="20" x2="80" y2="23" /><line x1="86" y1="23" x2="84" y2="25" /><line x1="89" y1="30" x2="87" y2="30" />
      <line x1="86" y1="37" x2="84" y2="35" /><line x1="80" y1="40" x2="80" y2="37" /><line x1="74" y1="37" x2="76" y2="35" />
      <line x1="71" y1="30" x2="73" y2="30" /><line x1="74" y1="23" x2="76" y2="25" />
    </g>
    <line x1="90" y1="30" x2="130" y2="30" strokeWidth="0.9" strokeDasharray="3 3" />
    <Rivets color={color} points={[[98,30],[106,30],[114,30],[122,30]]} />
  </g>
);

export const LaminatingIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <line x1="-40" y1="45" x2="10" y2="45" strokeWidth="1.3" />
    <line x1="-40" y1="41" x2="-5" y2="41" strokeWidth="0.35" strokeDasharray="3 2" opacity={0.5} />
    <line x1="-30" y1="10" x2="10" y2="20" strokeWidth="0.9" />
    <line x1="-30" y1="6" x2="-5" y2="15" strokeWidth="0.3" strokeDasharray="2 2" opacity={0.5} />
    <circle cx="5" cy="0" r="8" strokeWidth="1.1" />
    <g strokeWidth="0.35" opacity={0.6}>
      <line x1="0" y1="-5" x2="10" y2="5" /><line x1="3" y1="-7" x2="13" y2="3" />
    </g>
    <line x1="5" y1="8" x2="8" y2="16" strokeWidth="0.5" strokeDasharray="1 1" />
    <circle cx="30" cy="28" r="20" strokeWidth="1.6" />
    <circle cx="30" cy="28" r="15" strokeWidth="0.5" />
    <circle cx="30" cy="68" r="20" strokeWidth="1.6" />
    <circle cx="30" cy="68" r="15" strokeWidth="0.5" />
    <g strokeWidth="0.4" opacity={0.6}>
      <line x1="15" y1="46" x2="45" y2="50" /><line x1="15" y1="50" x2="45" y2="46" />
    </g>
    <circle cx="30" cy="28" r="3" strokeWidth="0.6" />
    <circle cx="30" cy="68" r="3" strokeWidth="0.6" />
    <line x1="50" y1="48" x2="100" y2="48" strokeWidth="1.8" />
    <line x1="50" y1="52" x2="100" y2="52" strokeWidth="0.4" opacity={0.5} />
    <line x1="55" y1="44" x2="90" y2="44" strokeWidth="0.3" strokeDasharray="3 2" opacity={0.5} />
  </g>
);


export const FoldingIcon: React.FC<IconProps> = ({ color }) => (
  <g stroke={color} fill="none">
    <line x1="-15" y1="88" x2="115" y2="88" strokeWidth="1.8" />
    <line x1="5" y1="88" x2="5" y2="72" strokeWidth="1.3" />
    <line x1="95" y1="88" x2="95" y2="72" strokeWidth="1.3" />
    <rect x="-1" y="68" width="12" height="6" strokeWidth="0.8" />
    <rect x="89" y="68" width="12" height="6" strokeWidth="0.8" />
    <circle cx="-40" cy="20" r="16" strokeWidth="1.4" />
    <circle cx="-40" cy="20" r="11" strokeWidth="0.5" />
    <circle cx="-40" cy="20" r="4" strokeWidth="0.6" />
    <line x1="-24" y1="20" x2="0" y2="20" strokeWidth="1" />
    <rect x="0" y="5" width="8" height="24" strokeWidth="1" />
    <path d="M4 29 L-2 44 L10 44 Z" strokeWidth="1" />
    <line x1="-10" y1="44" x2="30" y2="44" strokeWidth="0.5" opacity={0.6} />
    <line x1="10" y1="20" x2="30" y2="20" strokeWidth="1" />
    <rect x="30" y="0" width="120" height="70" rx="4" strokeWidth="1.7" />
    <rect x="40" y="10" width="100" height="50" rx="3" strokeWidth="0.5" />
    <g strokeWidth="0.4" opacity={0.4}>
      <line x1="25" y1="-10" x2="70" y2="75" /><line x1="45" y1="-15" x2="90" y2="75" /><line x1="65" y1="-18" x2="110" y2="70" />
    </g>
    <path d="M55 15 L80 15 L70 35 Z" strokeWidth="1.2" />
    <path d="M90 15 L115 15 L105 35 Z" strokeWidth="1.2" />
    <circle cx="60" cy="50" r="7" strokeWidth="1.1" />
    <circle cx="60" cy="50" r="2.8" strokeWidth="0.5" />
    <circle cx="120" cy="50" r="7" strokeWidth="1.1" />
    <circle cx="120" cy="50" r="2.8" strokeWidth="0.5" />
    <line x1="150" y1="35" x2="160" y2="35" strokeWidth="1" />
    <rect x="160" y="15" width="45" height="45" rx="2" strokeWidth="1.6" />
    <rect x="164" y="18" width="37" height="12" rx="1" strokeWidth="0.9" />
    <rect x="164" y="32" width="37" height="12" rx="1" strokeWidth="0.9" />
    <rect x="164" y="46" width="37" height="10" rx="1" strokeWidth="0.9" />
  </g>
);

const ICON_MAP: Record<MachineIconType, React.FC<IconProps>> = {
  filler: FillerIcon,
  wipes_line: WipesLineIcon,
  wash_glove: WashGloveIcon,
  tisu_sheet: TisuSheetIcon,
  alcohol_wipes: AlcoholWipesIcon,
  bagmaking: BagmakingIcon,
  banded_pack: BandedPackIcon,
  fliptop: FliptopIcon,
  slitting: SlittingIcon,
  cutting: CuttingIcon,
  perforating: PerforatingIcon,
  laminating: LaminatingIcon,
  folding: FoldingIcon,
};

export const renderMachineIcon = (iconType: string, color: string, unitCount?: number): React.ReactElement | null => {
  const Icon = ICON_MAP[iconType as MachineIconType];
  if (!Icon) return null;
  const props: IconProps = { color };
  if (unitCount !== undefined) props.unitCount = unitCount;
  return <Icon {...props} />;
};

export default ICON_MAP;
