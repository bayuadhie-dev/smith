import React, { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

// ─── Emoji Data ───────────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
  {
    id: 'recent', label: '🕒', name: 'Terbaru',
    emojis: [] as string[],
  },
  {
    id: 'people', label: '😀', name: 'Orang & Ekspresi',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙',
      '🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥',
      '😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓',
      '🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞',
      '😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖',
      '😺','😸','😹','😻','😼','😽','🙀','😿','😾','👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟',
      '🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝',
      '🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅',
      '💋','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏',
      '🙇','🤦','🤷','👮','🕵️','💂','🥷','👷','🤴','👸','👳','👲','🧙','🧚','🧛','🧜','🧝','🧞','🧟','🧌',
    ],
  },
  {
    id: 'nature', label: '🐶', name: 'Hewan & Alam',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒',
      '🦆','🐦','🦅','🦉','🦇','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🦟','🦗','🪳','🕷️','🦂','🐢','🐍',
      '🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭','🐊','🐅','🐆','🦓',
      '🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐',
      '🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🕊️','🐇','🦝','🦨','🦡','🦫',
      '🌵','🎄','🌲','🌳','🌴','🪵','🌱','🌿','☘️','🍀','🎍','🎋','🍃','🍂','🍁','🪺','🪹','🍄','🐚','🪸',
      '🪨','🌾','💐','🌷','🌹','🥀','🌺','🌸','🌼','🌻','🌞','🌝','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑',
      '⭐','🌟','💫','✨','☄️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','💨','🌬️','🌀','🌈','🌂',
    ],
  },
  {
    id: 'food', label: '🍕', name: 'Makanan & Minuman',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑',
      '🫑','🥦','🥬','🥒','🌶️','🫒','🧄','🧅','🥔','🍠','🫚','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈',
      '🥞','🧇','🥓','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫',
      '🍝','🍜','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🧁','🍰','🎂','🍮','🍭',
      '🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🫖','🍺','🍻','🥂','🍷','🥃','🍹',
    ],
  },
  {
    id: 'activity', label: '⚽', name: 'Aktivitas',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥍','🏏','🎿','🛷','🥌','🎯',
      '🪃','🏹','🎣','🤿','🎽','🎿','🛹','🛼','🪂','🏋️','🤸','🤼','🤺','🤾','🏇','⛷️','🏂','🪆','🎖️','🏆',
      '🥇','🥈','🥉','🏅','🎗️','🎫','🎟️','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺',
      '🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩','🪅','🪄',
    ],
  },
  {
    id: 'travel', label: '🚗', name: 'Perjalanan & Tempat',
    emojis: [
      '🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🚓','🚔',
      '🚕','🚖','🚗','🚘','🚙','🛻','🚚','🚛','🚜','🏎️','🏍️','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️',
      '🛞','⛽','🚨','🚥','🚦','🛑','🚧','⚓','🛟','⛵','🚤','🛥️','🛳️','⛴️','🚢','✈️','🛩️','🛫','🛬','🪂',
      '💺','🚁','🚟','🚠','🚡','🛰️','🚀','🛸','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬',
      '🌍','🌎','🌏','🗺️','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🗼','🗽','🗿',
    ],
  },
  {
    id: 'objects', label: '💡', name: 'Objek',
    emojis: [
      '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','🧮','📷','📸','📹','🎥','📽️','🎞️',
      '📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️',
      '💰','💴','💵','💶','💷','💸','💳','🪙','💹','📈','📉','📊','📋','🗒️','🗓️','📅','📆','🗑️','📁','📂',
      '🗃️','🗄️','🗑️','📄','📃','📑','🧾','📊','📈','📉','📦','📧','📨','📩','📤','📥','📪','📫','📬','📭',
      '📮','🗳️','✏️','✒️','🖊️','🖋️','📝','📖','📚','📙','📘','📗','📕','📓','📒','📃','📄','📑','🗒️','🗓️',
      '🔑','🗝️','🔒','🔓','🔨','🪓','⛏️','⚒️','🛠️','🗡️','⚔️','🛡️','🔧','🔩','⚙️','🗜️','🔗','⛓️','🪝','🧰',
      '💊','💉','🩸','🩹','🩺','🩻','🩼','🧬','🔬','🔭','🩱','🩲','👔','👕','👖','🧣','🧤','🧥','🥼','🦺',
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💕','💞','💓','💗','💖','💘','💝','❣️','💟','☮️','✝️',
    ],
  },
  {
    id: 'symbols', label: '✅', name: 'Simbol',
    emojis: [
      '✅','❎','🆗','🆙','🆒','🆕','🆓','🔝','🔛','🔜','🔚','⭕','🚫','💢','♨️','🚷','🚯','🚳','🚱','🔞',
      '📵','🔕','🔇','🔈','🔉','🔊','📢','📣','🔔','🔕','🎵','🎶','⚡','🔥','💥','⭐','🌟','💫','✨','🎉',
      '🎊','🎈','🎀','🎁','🎗️','🎟️','🎫','🏷️','🔖','💯','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺',
      '🔻','🔷','🔶','🔹','🔸','▪️','▫️','◾','◽','◼️','◻️','🔲','🔳','🔰','⚜️','〽️','♻️','🔱','📛','🔰',
      '⚠️','☢️','☣️','⬆️','↗️','➡️','↘️','⬇️','↙️','⬅️','↖️','↕️','↔️','↩️','↪️','⤴️','⤵️','🔃','🔄','🔙',
      '#️⃣','*️⃣','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','🔤','🔡','🔠','🅰️','🆎','🅱️',
    ],
  },
];

const RECENT_KEY = 'chat_recent_emojis';

const getRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
};

const addRecent = (emoji: string) => {
  const recent = getRecent().filter(e => e !== emoji);
  recent.unshift(emoji);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 30)));
};

// ─── EmojiPicker Component ────────────────────────────────────────────────────
interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('people');
  const [recent, setRecent] = useState<string[]>(getRecent);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSelect = (emoji: string) => {
    addRecent(emoji);
    setRecent(getRecent());
    onSelect(emoji);
  };

  const categories = EMOJI_CATEGORIES.map(c =>
    c.id === 'recent' ? { ...c, emojis: recent } : c
  ).filter(c => c.emojis.length > 0 || c.id !== 'recent');

  const filteredEmojis = search
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e =>
        EMOJI_CATEGORIES.some(c => c.name.toLowerCase().includes(search) || c.emojis.includes(e))
      )
    : null;

  const searchResults = search
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).slice(0, 60)
    : null;

  const displayCategories = search
    ? [{ id: 'search', label: '🔍', name: 'Hasil Pencarian', emojis: EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(() => true).slice(0, 80) }]
    : categories;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 right-0 z-50 w-80 bg-[#1e1f22] border border-[#3f4147] rounded-xl shadow-2xl overflow-hidden flex flex-col"
      style={{ height: 380 }}
    >
      {/* Search */}
      <div className="p-2 border-b border-[#3f4147]">
        <div className="flex items-center gap-2 bg-[#2b2d31] rounded-lg px-3 py-1.5">
          <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari emoji..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
          />
        </div>
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[#3f4147] overflow-x-auto no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              title={cat.name}
              className={`flex-shrink-0 p-1.5 rounded text-lg leading-none transition-colors ${activeCategory === cat.id ? 'bg-white/20' : 'hover:bg-white/10'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {search ? (
          <div>
            <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1 px-1">Hasil Pencarian</p>
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_CATEGORIES.flatMap(c => c.emojis)
                .filter((_, i) => i < 80)
                .map((emoji, i) => (
                  <button key={i} onClick={() => handleSelect(emoji)}
                    className="text-2xl p-1 rounded hover:bg-white/10 transition-colors leading-none"
                    title={emoji}>
                    {emoji}
                  </button>
                ))}
            </div>
          </div>
        ) : (
          categories
            .filter(c => c.emojis.length > 0 && (activeCategory === 'all' || c.id === activeCategory || c.id === 'recent'))
            .filter(c => c.id === activeCategory || c.id === 'recent')
            .map(cat => (
              <div key={cat.id}>
                <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1 px-1">{cat.name}</p>
                <div className="grid grid-cols-8 gap-0.5 mb-3">
                  {cat.emojis.map((emoji, i) => (
                    <button key={i} onClick={() => handleSelect(emoji)}
                      className="text-2xl p-1 rounded hover:bg-white/10 transition-colors leading-none"
                      title={emoji}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default EmojiPicker;
