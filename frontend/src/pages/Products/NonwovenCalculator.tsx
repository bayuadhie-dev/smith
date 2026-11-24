import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { showError, showSuccess } from '../../components/ui';
import NumberInput from '../../components/ui/NumberInput'
import { getApiURL } from '../../utils/apiConfig'
const NonwovenCalculator: React.FC = () => {
  const { t } = useLanguage();

  const [calculatorType, setCalculatorType] = useState<'gsm' | 'sheet-weight' | 'packaging' | 'uom'>('gsm');
  const [gsmInputs, setGsmInputs] = useState({
    width_cm: '',
    length_m: '',
    weight_g: ''
  });
  // Sheet Weight Calculator State
  const [sheetWeightInputs, setSheetWeightInputs] = useState({
    gsm: '',
    width_cm: '',
    length_cm: ''
  });

  // Packaging Calculator State
  const [packagingInputs, setPackagingInputs] = useState({
    sheets_per_pack: '',
    packs_per_karton: ''
  });

  // UOM Conversion State
  const [uomInputs, setUomInputs] = useState({
    value: '',
    from_uom: '',
    to_uom: ''
  });

  const handleGsmCalculate = async () => {
    try {
      const response = await fetch(getApiURL('/api/products/calculate/gsm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          width_cm: parseFloat(gsmInputs.width_cm),
          length_m: parseFloat(gsmInputs.length_m),
          weight_g: parseFloat(gsmInputs.weight_g)
        })
      });
      const result = await response.json();
      showSuccess(`GSM: ${result.gsm}`);
    } catch (error) {
      showError('GSM gagal dihitung.');
    }
  };

  const handleSheetWeightCalculate = async () => {
    try {
      const response = await fetch(getApiURL('/api/products/calculate/sheet-weight'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gsm: parseFloat(sheetWeightInputs.gsm),
          width_cm: parseFloat(sheetWeightInputs.width_cm),
          length_cm: parseFloat(sheetWeightInputs.length_cm)
        })
      });
      const result = await response.json();
      showSuccess(`Berat per lembar: ${result.weight_per_sheet_g} gram`);
    } catch (error) {
      showError('Berat lembar gagal dihitung.');
    }
  };

  const handlePackagingCalculate = async () => {
    try {
      const response = await fetch(getApiURL('/api/products/calculate/packaging'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheets_per_pack: parseInt(packagingInputs.sheets_per_pack),
          packs_per_karton: parseInt(packagingInputs.packs_per_karton)
        })
      });
      const result = await response.json();
      showSuccess(`Struktur kemasan: ${result.packaging_ratio}`);
    } catch (error) {
      showError('Struktur kemasan gagal dihitung.');
    }
  };

  const handleUomConvert = async () => {
    try {
      const response = await fetch(getApiURL('/api/products/convert/uom'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: parseFloat(uomInputs.value),
          from_uom: uomInputs.from_uom,
          to_uom: uomInputs.to_uom
        })
      });
      const result = await response.json();
      showSuccess(`Hasil konversi: ${result.converted_value} ${result.to_uom}`);
    } catch (error) {
      showError('Satuan gagal dikonversi.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <div className="fn-label mb-1.5">PRODUK · KALKULATOR NONWOVEN</div>
      <h1 className="text-[28px] font-semibold tracking-tight leading-tight">Kalkulator Nonwoven</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculator Type Selection */}
        <div className="fn-card p-6">
          <h2 className="text-xl font-semibold mb-4">Jenis kalkulator</h2>
          <div className="space-y-2">
            {[
              { value: 'gsm', label: 'Hitung GSM' },
              { value: 'sheet-weight', label: 'Hitung berat lembar' },
              { value: 'packaging', label: 'Hitung kemasan' },
              { value: 'uom', label: 'Konversi satuan' }
            ].map((type) => (
              <label key={type.value} className="flex items-center">
                <input
                  type="radio"
                  value={type.value}
                  checked={calculatorType === type.value}
                  onChange={(e) => setCalculatorType(e.target.value as any)}
                  className="mr-2"
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        {/* Calculator Interface */}
        <div className="fn-card p-6">
          {calculatorType === 'gsm' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Hitung GSM</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Lebar (cm)</label>
                  <NumberInput
                    className="w-full border rounded px-3 py-2"
                    value={gsmInputs.width_cm}
                    onChange={(e) => setGsmInputs({...gsmInputs, width_cm: e.target.value})}
                    placeholder="Lebar dalam cm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Panjang (m)</label>
                  <NumberInput
                    className="w-full border rounded px-3 py-2"
                    value={gsmInputs.length_m}
                    onChange={(e) => setGsmInputs({...gsmInputs, length_m: e.target.value})}
                    placeholder="Panjang dalam meter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Berat (g)</label>
                  <NumberInput
                    className="w-full border rounded px-3 py-2"
                    value={gsmInputs.weight_g}
                    onChange={(e) => setGsmInputs({...gsmInputs, weight_g: e.target.value})}
                    placeholder="Berat dalam gram"
                  />
                </div>
                <button
                  onClick={handleGsmCalculate}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                >
                  Hitung GSM
                </button>
              </div>
            </div>
          )}

          {calculatorType === 'sheet-weight' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Hitung berat lembar</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">GSM</label>
                  <NumberInput
                    className="w-full border rounded px-3 py-2"
                    value={sheetWeightInputs.gsm}
                    onChange={(e) => setSheetWeightInputs({...sheetWeightInputs, gsm: e.target.value})}
                    placeholder="Nilai GSM"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Lebar (cm)</label>
                  <NumberInput
                    className="w-full border rounded px-3 py-2"
                    value={sheetWeightInputs.width_cm}
                    onChange={(e) => setSheetWeightInputs({...sheetWeightInputs, width_cm: e.target.value})}
                    placeholder="Lebar dalam cm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Panjang (cm)</label>
                  <NumberInput
                    className="w-full border rounded px-3 py-2"
                    value={sheetWeightInputs.length_cm}
                    onChange={(e) => setSheetWeightInputs({...sheetWeightInputs, length_cm: e.target.value})}
                    placeholder="Panjang dalam cm"
                  />
                </div>
                <button
                  onClick={handleSheetWeightCalculate}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                >
                  Hitung berat lembar
                </button>
              </div>
            </div>
          )}

          {calculatorType === 'packaging' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Hitung kemasan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Lembar per pak</label>
                  <NumberInput
                    className="w-full border rounded px-3 py-2"
                    value={packagingInputs.sheets_per_pack}
                    onChange={(e) => setPackagingInputs({...packagingInputs, sheets_per_pack: e.target.value})}
                    placeholder="Lembar per pak"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Pak per karton</label>
                  <NumberInput
                    className="w-full border rounded px-3 py-2"
                    value={packagingInputs.packs_per_karton}
                    onChange={(e) => setPackagingInputs({...packagingInputs, packs_per_karton: e.target.value})}
                    placeholder="Pak per karton"
                  />
                </div>
                <button
                  onClick={handlePackagingCalculate}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                >
                  Hitung struktur kemasan
                </button>
              </div>
            </div>
          )}

          {calculatorType === 'uom' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Konversi satuan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nilai</label>
                  <NumberInput
                    className="w-full border rounded px-3 py-2"
                    value={uomInputs.value}
                    onChange={(e) => setUomInputs({...uomInputs, value: e.target.value})}
                    placeholder="Nilai yang mau dikonversi"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Dari satuan</label>
                    <select
                      className="w-full border rounded px-3 py-1"
                      value={uomInputs.from_uom}
                      onChange={(e) => setUomInputs({...uomInputs, from_uom: e.target.value})}
                    >
                      <option value="">Select UOM</option>
                      <option value="kg">Kg</option>
                      <option value="gram">Gram</option>
                      <option value="ton">Ton</option>
                      <option value="meter">Meter</option>
                      <option value="cm">Cm</option>
                      <option value="mm">Mm</option>
                      <option value="liter">Liter</option>
                      <option value="ml">Ml</option>
                      <option value="pcs">Pcs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Ke satuan</label>
                    <select
                      className="w-full border rounded px-3 py-1"
                      value={uomInputs.to_uom}
                      onChange={(e) => setUomInputs({...uomInputs, to_uom: e.target.value})}
                    >
                      <option value="">Select UOM</option>
                      <option value="kg">Kg</option>
                      <option value="gram">Gram</option>
                      <option value="ton">Ton</option>
                      <option value="meter">Meter</option>
                      <option value="cm">Cm</option>
                      <option value="mm">Mm</option>
                      <option value="liter">Liter</option>
                      <option value="ml">Ml</option>
                      <option value="pcs">Pcs</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleUomConvert}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                >
                  Konversi satuan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Categories Reference */}
      <div className="fn-card p-6">
        <h2 className="text-xl font-semibold mb-4">Acuan kategori nonwoven</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'Wet Tissue', gsm_range: [40, 80], width_range: [10, 30], length_range: [15, 25] },
            { name: 'Dry Tissue', gsm_range: [12, 25], width_range: [10, 30], length_range: [15, 25] },
            { name: 'Antiseptic Tissue', gsm_range: [35, 70], width_range: [10, 30], length_range: [15, 25] },
            { name: 'Sanitizer Tissue', gsm_range: [35, 70], width_range: [10, 30], length_range: [15, 25] },
            { name: 'Paper Towel', gsm_range: [20, 45], width_range: [20, 35], length_range: [20, 35] },
            { name: 'Facial Tissue', gsm_range: [12, 20], width_range: [15, 25], length_range: [18, 22] },
            { name: 'Baby Wipes', gsm_range: [45, 80], width_range: [15, 25], length_range: [18, 25] },
            { name: 'Lainnya', gsm_range: [10, 100], width_range: [5, 50], length_range: [5, 50] }
          ].map((category: any, index: number) => (
            <div key={index} className="p-3 border rounded">
              <h3 className="font-medium">{category.name}</h3>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                <p>GSM: {category.gsm_range[0]}-{category.gsm_range[1]}</p>
                <p>Lebar: {category.width_range[0]}-{category.width_range[1]} cm</p>
                <p>Panjang: {category.length_range[0]}-{category.length_range[1]} cm</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NonwovenCalculator;
