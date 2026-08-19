// Parses the output of the Windows `systeminfo` command into the subset of PC
// fields it can tell us about. Shared by the admin form's paste-to-fill box and
// the agent API, which accepts a raw dump instead of structured JSON.
export function parseSystemInfo(text) {
  const get = (label) => {
    const match = text.match(new RegExp(`^${label}:\\s*(.*)$`, 'im'));
    return match ? match[1].trim() : '';
  };

  const result = {};

  const hostName = get('Host Name');
  if (hostName) result.name = hostName;

  const manufacturer = get('System Manufacturer');
  if (manufacturer && !/unknown|to be filled/i.test(manufacturer)) result.brand = manufacturer;

  const osName = get('OS Name');
  if (/windows\s*11/i.test(osName)) result.os = 'Windows 11';
  else if (/windows\s*10/i.test(osName)) result.os = 'Windows 10';

  const editionMatch = osName.match(/\b(Home|Pro(?:fessional)?|Enterprise|Education)\b/i);
  if (editionMatch) {
    const edition = editionMatch[1].toLowerCase();
    if (edition.startsWith('pro')) result.os_edition = 'Pro';
    else result.os_edition = edition.charAt(0).toUpperCase() + edition.slice(1);
  }

  // systeminfo lists NICs under "Network Card(s)", each with an "IP address(es)"
  // block of indented "[01]: 10.0.0.5" lines. Take the first non-loopback IPv4.
  const ipBlock = text.match(/IP address\(es\)([\s\S]*?)(?:\n\s*\[\d+\]:\s*Connection Name|\n\S|$)/i);
  const ipMatch = (ipBlock ? ipBlock[1] : '').match(
    /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/
  );
  if (ipMatch && !/^127\./.test(ipMatch[0])) result.ip_address = ipMatch[0];

  const dhcpMatch = text.match(/DHCP Enabled:\s*(Yes|No)/i);
  const dhcp = dhcpMatch ? dhcpMatch[1] : '';
  if (/^yes$/i.test(dhcp)) result.ip_config = 'Dynamic';
  else if (/^no$/i.test(dhcp)) result.ip_config = 'Static';

  const cpuMatch = text.match(/^\s*\[01\]:\s*(.+)$/im);
  if (cpuMatch) result.cpu = cpuMatch[1].trim();

  const memMatch = text.match(/Total Physical Memory:\s*([\d,]+)\s*MB/i);
  if (memMatch) {
    const mb = Number(memMatch[1].replace(/,/g, ''));
    if (Number.isFinite(mb) && mb > 0) result.ram_gb = Math.round(mb / 1024);
  }

  return result;
}
