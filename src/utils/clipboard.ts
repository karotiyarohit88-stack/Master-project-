/**
 * Robust copy to clipboard utility with mobile-friendly fallback.
 * Handles iframe restrictions, insecure contexts, and older browser environments.
 */

export function fallbackCopyText(text: string): boolean {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  // Avoid scrolling to bottom in mobile
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.opacity = '0';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  let successful = false;
  try {
    successful = document.execCommand('copy');
    if (successful) {
      console.log('Fallback copy successful!');
    } else {
      console.error('Fallback copy failed');
    }
  } catch (err) {
    console.error('Unable to copy', err);
  }

  document.body.removeChild(textArea);
  return successful;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Copied successfully!');
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, using fallback', err);
      return fallbackCopyText(text);
    }
  } else {
    return fallbackCopyText(text);
  }
}
