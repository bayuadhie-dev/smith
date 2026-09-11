// Helper for Sundanese & Indonesian dynamic daily + office-hours login greetings matrix

export type TimeSlot = 'morning' | 'midday' | 'afternoon' | 'night';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'weekend';

export const FIRST_LOGIN_TODAY_MATRIX: Record<TimeSlot, string[]> = {
  morning: [
    "Wilujeng enjing {name}! Login pertama dinten ayeuna, ngopi heula ben semangat kerja kantor!",
    "Selamat pagi {name}! Login pertama hari ini, hayu awali hari ku niat baik jeung senyuman!",
    "Sugeng enjing {name}! Awal jam kerja dinten ayeuna, gaskeun absen jeung nggarap target!",
    "Aya nu bau kopi euy {name}! Login munggaran dinten ieu, sistem oge kangen ka anjeun!",
    "Wilujeng sumping deui {name}! Login pertama, mudah-mudahan teu aya WO nu ngambek dinten ieu!",
    "Enjing-enjing tos login {name}, rajin pisan! Absen dulu, ngeluh mah engke wae!"
  ],
  midday: [
    "Wilujeng siang {name}! Login pertama hari ini di jam siang, dahar siang heula ben boga tenaga!",
    "Selamat siang {name}! Barus login pertama dinten ayeuna, lanjutkeun semangat produktifna!",
    "Beurang kacida karek login {name}? Untung sistem sabar, teu protes sapertos mantan!",
    "Wilujeng siang telat login {name}! Nu penting hadir, sanes leuwih ti macet euy!"
  ],
  afternoon: [
    "Wilujeng sore {name}! Baru login pertama hari ini menjelang jam 5 sore, bereskeun laporan ngarah bisa pulang tenang!",
    "Sore {name}! Baru sempet login pertama dinten ayeuna? Jam 5 sore teng sakedap deui, gaskeun tugasna!",
    "Login sore-sore kieu {name}, marathon speed-run pisan! Gaskeun teu kudu lila-lila!",
    "Nembe login sore {name}? Data teh sabar ngantosan, teu sapertos WA gebetan!"
  ],
  night: [
    "Wilujeng wengi {name}! Baru login pertama malam ini? Tetep semangat ngalembur, rezeki moal kaliru!",
    "Selamat malam {name}! Login pertama malam hari euy, tetep jaga kesehatan jeung istirahat nya!",
    "Login peuting kieu {name}, sistem oge ngahuleng, na teu sare acan ieu teh?",
    "Wengi-wengi karek login {name}? Kopi jeung gorengan siap-siap, lembur mode: ON!"
  ]
};

export const GREETINGS_MATRIX: Record<DayOfWeek, Record<TimeSlot, string[]>> = {
  monday: {
    morning: [
      "Semangat Senin Pagi {name}! Awali minggu baru ku senyuman, ulah males nya!",
      "Senin jam 8 pagi nih {name}, absen wis beres? Hayu gaskeun ngarah boga tabungan!",
      "Wilujeng enjing hari Senin {name}! Ngopi heula ben semangat nggarap target minggu iki!",
      "Senin euy {name}! Weekend geus kabur, ayeuna waktosna jadi jagoan gudang deui!",
      "Monday blues teu berlaku {name}! Sistem geus siap, tinggal semangat anjeun weh nu kudu di-loading!"
    ],
    midday: [
      "Senin siang euy {name}! ISHOMA heula, isi tenaga ben uteukna teu spaneng!",
      "Selamat makan siang {name}! Satengah hari Senin tos dilalui, lanjutkeun produktifna!",
      "Sampai siang Senin tetep semangat {name}! Ulah lemes, dahar siang heula nya!",
      "Senin siang, mangkok dahar geus nungguan {name}! Kerja bisa, kalaparan mah ulah nya!"
    ],
    afternoon: [
      "Senin sore euy {name}! Sakedap deui jam 5 sore, bereskeun laporan hari Senin!",
      "Menjelang jam 5 sore di hari Senin, tetep fokus {name}! Jam 5 pas langsung gaskeun pulang!",
      "Sore Senin manis {name}! Tugas hari ini tos beres durung? Hayu gaskeun saeutik deui!",
      "Garis finish Senin geus deukeut {name}! Sesah-sesah keneh, tapi anjeun leuwih kuat!"
    ],
    night: [
      "Senin malam masih lembur {name}? Mantap pisan dedikasina, tetep jaga kesehatan nya!",
      "Overtime hari Senin euy {name}! Ulah hilap nginum cai bodas jeung rehat saeutik!",
      "Senin peuting keneh dikantor {name}? Bos oge kudu apal ieu perjuangan!"
    ]
  },
  tuesday: {
    morning: [
      "Selasa Ceria {name}! Pekerjaan hari ini mulai mengalir lancar, gaskeun!",
      "Wilujeng enjing hari Selasa {name}! Awali pagi jam 8 ku semangat membara!",
      "Selamat pagi {name}! Selasa kie mah kedah tetep produktif jeung santuy!",
      "Selasa pagi {name}, Senin geus kalewat, tinggal ngalir sapertos cai walungan!"
    ],
    midday: [
      "Selasa siang euy {name}! Tos waktosna istirahat jeung maam siang, ulah telat nya!",
      "Siang Selasa {name}! Satengah jalan hari Selasa beres, lanjutkeun ngitung stok!",
      "Selasa siang bolong {name}, waktos pas keur ngaso jeung ngeusian tank BBM (baterai badan)!"
    ],
    afternoon: [
      "Selasa sore {name}! Jam 4 sore siap-siap bereskeun gawean sebelum jam 5 teng!",
      "Sore hari Selasa {name}! Sakedap deui jam 5 sore pulang, tuntaskan sisa tugasna!",
      "Selasa sore, semangat masih 80% {name}! Cekap keur bereskeun sisa laporan!"
    ],
    night: [
      "Selasa malam masih di kantor {name}? Lembur squad mantap, tetep semangat nya!",
      "Overtime hari Selasa {name}! Tetep jaga kondisi jeung istirahat nya!",
      "Peuting Selasa masih online {name}? Simkuring salut, ulah hilap ngaso!"
    ]
  },
  wednesday: {
    morning: [
      "Rabu manis {name}! Minggu iki tos satengah jalan, gaskeun semangat pagina!",
      "Wilujeng enjing hari Rabu {name}! Ngopi heula ben uteukna teu spaneng nggarap WO!",
      "Semangat Rabu pagi {name}! Jam 8 pas masuk kantor, hayu fokus nggarap data!",
      "Rabu = tengah minggu {name}! Setengah medal, setengah deui gancang beres!"
    ],
    midday: [
      "Rabu siang euy {name}! Waktosna ISHOMA, maam siang heula ben boga tenaga!",
      "Selamat siang hari Rabu {name}! Tetep produktif, akhir pekan tos semakin dekat!",
      "Rabu siang, checkpoint minggu geus kaliwat {name}! Tinggal nurunan ka Jumat!"
    ],
    afternoon: [
      "Rabu sore euy {name}! Menjelang jam 5 sore, siap-siap bereskeun gawean hari ini!",
      "Sore hari Rabu {name}! Jam 5 teng tinggal sakedap deui, gaskeun laporan pungkasan!",
      "Rabu sore, gunung tos katembong puncakna {name}! Kamis Jumat mah geus deukeut!"
    ],
    night: [
      "Rabu malam OT euy {name}! Ngalembur pertengahan minggu, mantap pisan dedikasina!",
      "Lembur hari Rabu {name}! Ulah kalakuan teuing, rehat saeutik ngarah uteukna fress!",
      "Peuting Rabu masih di kantor {name}? Setengah minggu, setengah baterai, cepet ngecas!"
    ]
  },
  thursday: {
    morning: [
      "Kamis manis {name}! Enjing tos Jumat euy, gaskeun semangat pagi kantor!",
      "Wilujeng enjing hari Kamis {name}! Awali pagi jam 8 ku senyuman jeung fokus!",
      "Semangat Kamis pagi {name}! Sakedap deui akhir pekan, ulah kendor nya!",
      "Kamis euy {name}! Aroma Jumat geus kaambeu, tapi kerjaan kedah tetep tuntas heula!"
    ],
    midday: [
      "Kamis siang euy {name}! Rehat heula jam siang, isi tenaga ben teu lemes!",
      "Selamat makan siang hari Kamis {name}! Lanjutkeun semangat nggarap target!",
      "Kamis siang, tinggal 1.5 hari deui {name}! Sanajan kitu ulah asa-asa nya!"
    ],
    afternoon: [
      "Kamis sore euy {name}! Sakedap deui jam 5 sore pulang, besok udah Jumat!",
      "Sore hari Kamis {name}! Menjelang jam 5 sore teng, tuntaskan sisa tugasna nya!",
      "Kamis sore, sinyal weekend geus kadenge {name}! Bereskeun heula gawean nu numpuk!"
    ],
    night: [
      "Kamis malam jumat heulaan {name}! Masih ngalembur? Mantap, tetep jaga kondisi!",
      "Overtime hari Kamis {name}! Gaskeun saeutik deui ngarah besok Jumat lebih tenang!",
      "Peuting Kamis masih standby {name}? Salut, Jumat kudu leuwih santai da geus dianggo capek!"
    ]
  },
  friday: {
    morning: [
      "Jumat Berkah {name}! TGIF euy, gaskeun semangat pagi sebelum akhir pekan!",
      "Wilujeng enjing hari Jumat {name}! Awali hari Jumat ku niat baik jeung senyuman!",
      "Semangat Jumat pagi {name}! Sakedap deui akhir pekan tiba, gaskeun tugasna!",
      "Jumat geus dongkap {name}! Weekend nyorongkeun panangan, tapi absen heula nya!"
    ],
    midday: [
      "Jumat Siang Berkah {name}! Ulah hilap Sholat Jumat & istirahat makan siang nya!",
      "Selamat siang hari Jumat {name}! Aura akhir pekan tos berasa pisan euy!",
      "Jumat siang, weekend mode geus 60% loading {name}! Beresan heula gawean anu tereh!"
    ],
    afternoon: [
      "TGIF Sore {name}! Jam 5 sore teng langsung gaskeun weekend, gawean tos beres durung?",
      "Jumat sore euy {name}! Menjelang jam 5 sore pulang, tuntaskan laporan ngarah weekend tenang!",
      "Jumat sore, kompor weekend geus dihurungkeun {name}! Sakedap deui bebas!"
    ],
    night: [
      "Jumat malam masih di kantor {name}? Lembur Jumat mantap pisan, tetep semangat!",
      "Akhir pekan tiba tapi masih OT {name}? Mantap pisan dedikasina dulur!",
      "Weekend nungguan di luar tapi anjeun masih lembur {name}? Sabar nya, engke ganti liburan!"
    ]
  },
  weekend: {
    morning: [
      "Wilujeng akhir pekan {name}! Ngalembur pagi di akhir pekan? Mantap pisan dedikasina!",
      "Weekend tetep login pagi {name}? Tetep semangat dulur, rezeki moal kaliru nya!",
      "Sabtu/Minggu tapi tetep login {name}? Kadeudeuh pisan ka gawean, tapi ulah hilap istirahat nya!"
    ],
    midday: [
      "Siang akhir pekan {name}! Tetep produktif tapi ulah hilap istirahat & makan siang!",
      "Weekend siang, login keneh {name}? Salut, tapi jangan lupa dahar siang nu enak!"
    ],
    afternoon: [
      "Sore akhir pekan {name}! Tetep semangat ngalembur, sebentar lagi kelar!",
      "Sore weekend {name}, dedikasi anjeun teh kudu diapresiasi ku kopi extra hot!"
    ],
    night: [
      "Lembur malam akhir pekan {name}? Jaga kesehatan nya dulur, istirahat secukupnya!",
      "Peuting weekend masih online {name}? Data mah teu wawuh weekend, tapi awak anjeun perlu istirahat!"
    ]
  }
};

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
  const now = new Date();
  const currentHour = now.getHours();

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

  const isFirstLoginToday = isFirstTime || checkIsFirstLoginToday();

  if (isFirstLoginToday) {
    const options = FIRST_LOGIN_TODAY_MATRIX[slotKey];
    const template = options[Math.floor(Math.random() * options.length)];
    return template.replace('{name}', name);
  }

  const dayNum = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
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

  const options = GREETINGS_MATRIX[dayKey][slotKey];
  const selected = options[Math.floor(Math.random() * options.length)];
  return selected.replace('{name}', name);
};
