export const GROUP_LABEL: Record<string, string> = {
  finished_goods: 'Barang Jadi', wip: 'Barang Setengah Jadi', raw_materials: 'Bahan Baku', packaging_materials: 'Bahan Kemas',
  chemical_materials: 'Bahan Kimia', non_inventory: 'Non Persediaan', waste: 'Waste', premix: 'Premix',
}
export const groupLabel = (g: string) => GROUP_LABEL[g] || g.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
