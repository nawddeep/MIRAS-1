export class DeviceInfo {
  static get model(): string {
    if (typeof navigator === 'undefined') {
      return 'WebBrowser';
    }
    const ua = navigator.userAgent || '';
    const navAny = navigator as unknown as {
      userAgentData?: { platform?: string; mobile?: boolean; brands?: Array<{ brand: string }> };
    };
    if (navAny.userAgentData?.platform) {
      const mobileTag = navAny.userAgentData.mobile ? 'Mobile' : 'Desktop';
      return `${navAny.userAgentData.platform}-${mobileTag}`;
    }
    if (/iPhone/.test(ua)) return 'iPhone-Web';
    if (/iPad/.test(ua)) return 'iPad-Web';
    if (/Android/.test(ua)) {
      const match = ua.match(/Android\s+[\d.]+;\s*([^;)]+)/);
      return match ? `Android-${match[1].trim()}` : 'Android-Web';
    }
    if (/Macintosh/.test(ua)) return 'Mac-Web';
    if (/Windows/.test(ua)) return 'Windows-Web';
    if (/Linux/.test(ua)) return 'Linux-Web';
    return 'Web-PWA';
  }
}
