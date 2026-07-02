import { useState, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";
import { isBiometricAvailable, hasBiometricEnrolled, registerBiometric } from "../utils/biometrics";
import { useToast } from "../utils/ToastContext";
import { haptics } from "../utils/haptics";

interface BiometricSettingsProps {
  userEmail: string | null;
}

export function BiometricSettings({ userEmail }: BiometricSettingsProps) {
  const { showToast } = useToast();
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricSupported);
    if (userEmail) {
      setBiometricEnrolled(hasBiometricEnrolled(userEmail));
    }
  }, [userEmail]);

  const toggleBiometric = async () => {
    if (!userEmail) return;

    if (biometricEnrolled) {
      localStorage.removeItem(`biometricAuth_${userEmail}`);
      setBiometricEnrolled(false);
      showToast("Biometric login disabled.", "success");
    } else {
      setIsEnrolling(true);
      const result = await registerBiometric(userEmail);
      setIsEnrolling(false);
      
      if (result.success) {
        setBiometricEnrolled(true);
        showToast("Biometric login enabled successfully.", "success");
      } else {
        if (result.error?.includes('publickey-credentials-create')) {
          showToast("Your browser blocks this in preview mode. Try opening in a new tab.", "error");
        } else {
          showToast(result.error || "Failed to enable biometric login.", "error");
        }
      }
    }
  };

  return (
    <div className="bg-surface-container rounded-xl overflow-hidden border border-outline-variant shadow-sm">
      <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <h2 className="font-label-lg font-semibold text-on-surface">Security</h2>
      </div>
      <div className="p-4 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="font-medium text-on-surface">Biometric Login</p>
            <p className="text-sm text-on-surface-variant">Use your fingerprint or face ID for faster, more secure logins.</p>
            {!biometricSupported && (
              <p className="text-xs text-error mt-1 font-medium">Your device or browser does not support biometric authentication.</p>
            )}
          </div>
          <button
            disabled={!biometricSupported || !userEmail || isEnrolling}
            onClick={() => {
              haptics.tap();
              toggleBiometric();
            }}
            className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 disabled:opacity-50 flex items-center relative ${biometricEnrolled ? 'bg-primary' : 'bg-surface-variant'}`}
          >
            <div className={`w-4 h-4 rounded-full shadow-sm transform transition-transform flex items-center justify-center ${biometricEnrolled ? 'translate-x-6 bg-on-primary' : 'translate-x-0 bg-on-surface-variant'}`}>
              {isEnrolling && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
