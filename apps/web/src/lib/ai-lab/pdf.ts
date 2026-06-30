export function assignFileInput(input: HTMLInputElement, fileList: FileList) {
  const dt = new DataTransfer();
  Array.from(fileList).forEach((file) => dt.items.add(file));
  input.files = dt.files;
}

export async function loadDefaultPdfFile(): Promise<File | null> {
  const res = await fetch('/default-docs/imptfs.pdf');
  if (!res.ok) return null;
  const blob = await res.blob();
  return new File([blob], 'I M P T F S.pdf', { type: 'application/pdf' });
}
