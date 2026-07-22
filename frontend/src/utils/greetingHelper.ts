// Helper for Sundanese & Indonesian dynamic daily + office-hours login greetings matrix

export type TimeSlot = 'morning' | 'midday' | 'afternoon' | 'night';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'weekend';

export const GREETINGS_MATRIX: Record<DayOfWeek, Record<TimeSlot, string[]>> = {
  monday: {
    morning: [
      "Semangat Senin Pagi {name}! Awali minggu baru ku senyuman, ulah males nya!",
      "Senin jam 8 pagi nih {name}, absen wis beres? Hayu gaskeun ngarah boga tabungan!",
      "Wilujeng enjing hari Senin {name}! Ngopi heula ben semangat nggarap target minggu iki!"
    ],
    midday: [
      "Senin siang euy {name}! ISHOMA heula, isi tenaga ben uteukna teu spaneng!",
      "Selamat makan siang {name}! Satengah hari Senin tos dilalui, lanjutkeun produktifna!",
      "Sampai siang Senin tetep semangat {name}! Ulah lemes, dahar siang heula nya!"
    ],
    afternoon: [
      "Senin sore euy {name}! Sakedap deui jam 5 sore, bereskeun laporan hari Senin!",
      "Menjelang jam 5 sore di hari Senin, tetep fokus {name}! Jam 5 pas langsung gaskeun pulang!",
      "Sore Senin manis {name}! Tugas hari ini tos beres durung? Hayu gaskeun saeutik deui!"
    ],
    night: [
      "Senin malam masih lembur {name}? Mantap pisan dedikasina, tetep jaga kesehatan nya!",
      "Overtime hari Senin euy {name}! Ulah hilap nginum cai bodas jeung rehat saeutik!"
    ]
  },
  tuesday: {
    morning: [
      "Selasa Ceria {name}! Pekerjaan hari ini mulai mengalir lancar, gaskeun!",
      "Wilujeng enjing hari Selasa {name}! Awali pagi jam 8 ku semangat membara!",
      "Selamat pagi {name}! Selasa kie mah kedah tetep produktif jeung santuy!"
    ],
    midday: [
      "Selasa siang euy {name}! Tos waktosna istirahat jeung maam siang, ulah telat nya!",
      "Siang Selasa {name}! Satengah jalan hari Selasa beres, lanjutkeun ngitung stok!"
    ],
    afternoon: [
      "Selasa sore {name}! Jam 4 sore siap-siap bereskeun gawean sebelum jam 5 teng!",
      "Sore hari Selasa {name}! Sakedap deui jam 5 sore pulang, tuntaskan sisa tugasna!"
    ],
    night: [
      "Selasa malam masih di kantor {name}? Lembur squad mantap, tetep semangat nya!",
      "Overtime hari Selasa {name}! Tetep jaga kondisi jeung istirahat nya!"
    ]
  },
  wednesday: {
    morning: [
      "Rabu manis {name}! Minggu iki tos satengah jalan, gaskeun semangat pagina!",
      "Wilujeng enjing hari Rabu {name}! Ngopi heula ben uteukna teu spaneng nggarap WO!",
      "Semangat Rabu pagi {name}! Jam 8 pas masuk kantor, hayu fokus nggarap data!"
    ],
    midday: [
      "Rabu siang euy {name}! Waktosna ISHOMA, maam siang heula ben boga tenaga!",
      "Selamat siang hari Rabu {name}! Tetep produktif, akhir pekan tos semakin dekat!"
    ],
    afternoon: [
      "Rabu sore euy {name}! Menjelang jam 5 sore, siap-siap bereskeun gawean hari ini!",
      "Sore hari Rabu {name}! Jam 5 teng tinggal sakedap deui, gaskeun laporan pungkasan!"
    ],
    night: [
      "Rabu malam OT euy {name}! Ngalembur pertengahan minggu, mantap pisan dedikasina!",
      "Lembur hari Rabu {name}! Ulah kalakuan teuing, rehat saeutik ngarah uteukna fress!"
    ]
  },
  thursday: {
    morning: [
      "Kamis manis {name}! Enjing tos Jumat euy, gaskeun semangat pagi kantor!",
      "Wilujeng enjing hari Kamis {name}! Awali pagi jam 8 ku senyuman jeung fokus!",
      "Semangat Kamis pagi {name}! Sakedap deui akhir pekan, ulah kendor nya!"
    ],
    midday: [
      "Kamis siang euy {name}! Rehat heula jam siang, isi tenaga ben teu lemes!",
      "Selamat makan siang hari Kamis {name}! Lanjutkeun semangat nggarap target!"
    ],
    afternoon: [
      "Kamis sore euy {name}! Sakedap deui jam 5 sore pulang, besok udah Jumat!",
      "Sore hari Kamis {name}! Menjelang jam 5 sore teng, tuntaskan sisa tugasna nya!"
    ],
    night: [
      "Kamis malam jumat heulaan {name}! Masih ngalembur? Mantap, tetep jaga kondisi!",
      "Overtime hari Kamis {name}! Gaskeun saeutik deui ngarah besok Jumat lebih tenang!"
    ]
  },
  friday: {
    morning: [
      "Jumat Berkah {name}! TGIF euy, gaskeun semangat pagi sebelum akhir pekan!",
      "Wilujeng enjing hari Jumat {name}! Awali hari Jumat ku niat baik jeung senyuman!",
      "Semangat Jumat pagi {name}! Sakedap deui akhir pekan tiba, gaskeun tugasna!"
    ],
    midday: [
      "Jumat Siang Berkah {name}! Ulah hilap Sholat Jumat & istirahat makan siang nya!",
      "Selamat siang hari Jumat {name}! Aura akhir pekan tos berasa pisan euy!"
    ],
    afternoon: [
      "TGIF Sore {name}! Jam 5 sore teng langsung gaskeun weekend, gawean tos beres durung?",
      "Jumat sore euy {name}! Menjelang jam 5 sore pulang, tuntaskan laporan ngarah weekend tenang!"
    ],
    night: [
      "Jumat malam masih di kantor {name}? Lembur Jumat mantap pisan, tetep semangat!",
      "Akhir pekan tiba tapi masih OT {name}? Mantap pisan dedikasina dulur!"
    ]
  },
  weekend: {
    morning: [
      "Wilujeng akhir pekan {name}! Ngalembur pagi di akhir pekan? Mantap pisan dedikasina!",
      "Weekend tetep login pagi {name}? Tetep semangat dulur, rezeki moal kaliru nya!"
    ],
    midday: [
      "Siang akhir pekan {name}! Tetep produktif tapi ulah hilap istirahat & makan siang!"
    ],
    afternoon: [
      "Sore akhir pekan {name}! Tetep semangat ngalembur, sebentar lagi kelar!"
    ],
    night: [
      "Lembur malam akhir pekan {name}? Jaga kesehatan nya dulur, istirahat secukupnya!"
    ]
  }
};

// Greetings specifically for the FIRST LOGIN OF THE DAY (Login Pertama Hari Ini)
export const FIRST_LOGIN_OF_DAY_GREETINGS = [
  "Wilujeng enjing {name}! Login pertama dinten ayeuna, ngopi heula ben semangat kerja kantor!",
  "Selamat pagi {name}! Login pertama hari ini, hayu awali hari ku niat baik jeung senyuman!",
  "Sugeng enjing {name}! Awal jam kerja dinten ayeuna, gaskeun absen jeung nggarap target!",
  "Halo {name}! Semangat login pertama hari ini, tetep fokus jeung ulah spaneng nya!"
];

export const checkIsFirstLoginToday = (): boolean => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastLoginDate = localStorage.getItem('last_login_date_str');
    if (lastLoginDate !== todayStr) {
      localStorage.setItem('last_login_date_str', todayStr);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export const getDynamicLoginGreeting = (fullName?: string, isFirstTime: boolean = false): string => {
  const name = fullName ? fullName.split(' ')[0] : 'Dulur';
  
  const isFirstLoginToday = isFirstTime || checkIsFirstLoginToday();
  
  if (isFirstLoginToday) {
    const template = FIRST_LOGIN_OF_DAY_GREETINGS[Math.floor(Math.random() * FIRST_LOGIN_OF_DAY_GREETINGS.length)];
    return template.replace('{name}', name);
  }
  
  const now = new Date();
  const dayNum = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const currentHour = now.getHours();
  
  let dayKey: DayOfWeek = 'monday';
  switch (dayNum) {
    case 1: dayKey = 'monday'; break;
    case 2: dayKey = 'tuesday'; break;
    case 3: dayKey = 'wednesday'; break;
    case 4: dayKey = 'thursday'; break;
    case 5: dayKey = 'friday'; break;
    case 0:
    case 6:
    default: dayKey = 'weekend'; break;
  }
  
  let slotKey: TimeSlot = 'morning';
  if (currentHour >= 6 && currentHour < 11) {
    slotKey = 'morning';
  } else if (currentHour >= 11 && currentHour < 14) {
    slotKey = 'midday';
  } else if (currentHour >= 14 && currentHour <= 17) {
    slotKey = 'afternoon';
  } else {
    slotKey = 'night';
  }
  
  const options = GREETINGS_MATRIX[dayKey][slotKey];
  const selected = options[Math.floor(Math.random() * options.length)];
  return selected.replace('{name}', name);
};
