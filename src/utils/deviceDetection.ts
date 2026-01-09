export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export const detectDeviceType = (): DeviceType => {
  const userAgent = navigator.userAgent.toLowerCase();
  const viewportWidth = window.innerWidth;

  // Check user agent for mobile/tablet patterns
  const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTabletUA = /ipad|android(?!.*mobi)|tablet/i.test(userAgent);

  // Viewport-based detection as fallback
  if (viewportWidth < 768) {
    return 'mobile';
  } else if (viewportWidth < 1024) {
    return isTabletUA ? 'tablet' : 'desktop';
  }

  if (isMobileUA) return 'mobile';
  if (isTabletUA) return 'tablet';
  
  return 'desktop';
};

export const isMobileDevice = (): boolean => {
  return detectDeviceType() === 'mobile';
};

export const isTabletDevice = (): boolean => {
  return detectDeviceType() === 'tablet';
};

export const isMobileOrTablet = (): boolean => {
  const deviceType = detectDeviceType();
  return deviceType === 'mobile' || deviceType === 'tablet';
};
