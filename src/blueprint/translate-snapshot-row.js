function translateSnapshotRow(row) {
  let low = 0
  let high = snapshotAuxiliaryData.snapshotSections.length - 1

  while (low <= high) {
    const mid = low + ((high - low) >> 1)
    const section = snapshotAuxiliaryData.snapshotSections[mid]

    if (row < section.startRow) {
      high = mid - 1
    } else if (row >= section.endRow) {
      low = mid + 1
    } else {
      return {
        relativePath: section.relativePath,
        row: row - section.startRow,
      }
    }
  }

  return {
    relativePath: '<embedded>',
    row: row,
  }
}
