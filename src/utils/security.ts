export function scanEmailSecurity(htmlBody: string = '', textBody: string = '', sender: string = '') {
  let isSuspicious = false;
  let warnings: string[] = [];

  const combinedContent = (htmlBody + ' ' + textBody).toLowerCase();
  
  // 1. Phishing Keywords
  const phishingKeywords = [
    'reset password', 'verifikasi', 'verify your account', 'update your billing',
    'suspended', 'urgent action required', 'bank', 'login to continue',
    'click here to claim', 'lottery', 'winner', 'confirm your identity'
  ];

  for (const word of phishingKeywords) {
    if (combinedContent.includes(word)) {
      isSuspicious = true;
      warnings.push(`Mengandung kata kunci mencurigakan: "${word}"`);
    }
  }

  // 2. Suspicious Links / Shorteners
  const suspiciousDomains = [
    'bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'is.gd', 'cutt.ly', 'goo.gl'
  ];

  for (const domain of suspiciousDomains) {
    if (combinedContent.includes(domain)) {
      isSuspicious = true;
      warnings.push(`Mengandung pemendek tautan yang sering dipakai penipuan: ${domain}`);
    }
  }

  // 3. Dangerous Attachments/Links
  if (combinedContent.includes('.exe') || combinedContent.includes('.zip') || combinedContent.includes('.scr')) {
    isSuspicious = true;
    warnings.push('Mungkin berisi lampiran atau tautan berbahaya (.exe / .zip)');
  }

  return {
    isSafe: !isSuspicious,
    warnings: [...new Set(warnings)].slice(0, 3) // Return max 3 unique warnings
  };
}
