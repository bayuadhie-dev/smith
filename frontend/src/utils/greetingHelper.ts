// Helper for Sundanese & Indonesian dynamic office-hours login greetings (08:00 - 17:00 WIB)

export interface TimeSlotGreetings {
  morning: string[];   // 06:00 - 10:59 (Awal kerja & Jam 8 Masuk)
  midday: string[];    // 11:00 - 13:59 (Siang & ISHOMA)
  afternoon: string[]; // 14:00 - 17:00 (Sore & Menjelang Jam 5 Pulang)
  night: string[];     // 17:01 - 05:59 (Lembur / Luar Jam Kerja Kantor)
  firstLogin: string[];
}

export const OFFICE_GREETINGS: TimeSlotGreetings = {
  firstLogin: [
    "Wilujeng sumping dulur! Hari pertama kerja di kantor, gaskeun ulah kendor nya!",
    "Selamat datang karyawan baru! Tetep kalem, ulah spaneng di hari pertama.",
    "Hore anggota anyar! Wilujeng gabung, ngopi heula ben semangat!"
  ],
  morning: [
    "Wilujeng enjing! Jam 8 pas masuk kantor, ngopi heula ben semangat kerja dinten ayeuna!",
    "Semangat pagi! Absen wis beres? Hayu gaskeun tugas kantor dinten ayeuna!",
    "Sugeng enjing dulur! Awali jam kerja pagi ku senyuman jeung niat baik!",
    "Wilujeng enjing! Pagi-pagi ulah lemes nya, gaskeun ngarah boga tabungan!"
  ],
  midday: [
    "Wilujeng siang! Tos waktosna ISHOMA/rehat saeutik, ulah hilap tuang siang nya!",
    "Siang ceria! Lanjutkeun semangatna, satengah hari kerja tos dilalui euy!",
    "Wilujeng tengah dinten! Isi tenaga heula ben uteukna teu spaneng nggarap data!",
    "Jam siang kie mah tetep produktif tapi ulah telat maam nya dulur!"
  ],
  afternoon: [
    "Wilujeng sore! Sakedap deui teng jam 5 sore, bereskeun tugas ngarah tiasa pulang tenang!",
    "Jam 4 sore siap-siap! Tuntaskan sisa laporan kantor, siap-siap mulang dulur!",
    "Menjelang jam 5 sore tetep fokus! Jam 5 pas teng langsung gaskeun pulang nya!",
    "Sore manis! Gawean kantor tos tuntas durung? Hayu gaskeun saeutik deui!"
  ],
  night: [
    "Wilujeng wengi! Masih lembur euy di atas jam 5 sore? Mantap pisan dedikasina!",
    "Di luar jam kerja kantor tetep login? Tetep jaga kesehatan jeung istirahat nya dulur!",
    "Overtime mode ON! Tetep semangat ngalembur, rezeki moal kaliru nya!",
    "Wengi-wengi masih nggarap tugas? Kalem saeutik, ulah hilap nginum cai bodas!"
  ]
};

export const getDynamicLoginGreeting = (fullName?: string, isFirstTime: boolean = false): string => {
  const name = fullName ? fullName.split(' ')[0] : 'Dulur';
  
  if (isFirstTime) {
    const list = OFFICE_GREETINGS.firstLogin;
    const msg = list[Math.floor(Math.random() * list.length)];
    return `${msg} (Selamat Datang, ${name}!)`;
  }
  
  const currentHour = new Date().getHours();
  let timeList: string[] = [];
  
  if (currentHour >= 6 && currentHour < 11) {
    timeList = OFFICE_GREETINGS.morning;
  } else if (currentHour >= 11 && currentHour < 14) {
    timeList = OFFICE_GREETINGS.midday;
  } else if (currentHour >= 14 && currentHour <= 17) {
    timeList = OFFICE_GREETINGS.afternoon;
  } else {
    timeList = OFFICE_GREETINGS.night;
  }
  
  const randomMsg = timeList[Math.floor(Math.random() * timeList.length)];
  return `${randomMsg} (Wilujeng Sumping, ${name}!)`;
};
