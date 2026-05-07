import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../stores/useAuthStore';

type Step = 'phone' | 'otp';

export default function AuthPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/send-otp', { phone });
      setStep('otp');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/verify-otp', { phone, code: otp });
      setAuth(res.data.user, res.data.wallet, res.data.token);
      navigate('/');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Invalid OTP. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-950">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="text-6xl">🔫</div>
          <h1 className="text-3xl font-bold tracking-tight">Buckshot Bet</h1>
          <p className="text-gray-400">Challenge your friends. Survive the roulette.</p>
        </div>

        <div className="card space-y-4">
          {step === 'phone' ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+1 234 567 8900"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  In dev mode, OTP will appear in the server console.
                </p>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-danger w-full py-3 text-lg"
                disabled={loading || !phone}
              >
                {loading ? 'Sending...' : 'Get Code →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                  className="text-sm text-gray-500 hover:text-gray-300 mb-3 flex items-center gap-1"
                >
                  ← Back
                </button>

                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Enter 6-Digit Code
                </label>
                <p className="text-sm text-gray-400 mb-3">
                  Sent to <span className="text-white font-medium">{phone}</span>
                  <br />
                  <span className="text-xs text-gray-500">(Check the server console in dev mode)</span>
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="input text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-danger w-full py-3 text-lg"
                disabled={loading || otp.length !== 6}
              >
                {loading ? 'Verifying...' : 'Enter the Chamber 🔫'}
              </button>

              <button
                type="button"
                onClick={() => { setOtp(''); handleSendOTP({ preventDefault: () => {} } as React.FormEvent); }}
                className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Resend code
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-600">
          By continuing you agree to play responsibly. Virtual coins only.
        </p>
      </div>
    </div>
  );
}
