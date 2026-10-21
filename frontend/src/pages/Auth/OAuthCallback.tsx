import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/redux';
import { setCredentials } from '../../store/slices/authSlice';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const handleCallback = async () => {
      // Check for error from Google
      const error = searchParams.get('error');
      if (error) {
        setStatus('error');
        toast.error(`Login failed: ${error}`);
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // Check for Google OAuth code
      const code = searchParams.get('code');
      if (code) {
        try {
          // Exchange code for tokens via backend
          const response = await axiosInstance.post('/api/auth/google/callback', { code });
          const { access_token, refresh_token, user } = response.data;

          // Store tokens
          localStorage.setItem('token', access_token);
          if (refresh_token) {
            localStorage.setItem('refresh_token', refresh_token);
          }

          // Update Redux
          dispatch(setCredentials({
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              full_name: user.full_name,
              is_admin: user.is_admin || false,
              is_super_admin: user.is_super_admin || false,
              roles: user.roles || []
            },
            token: access_token
          }));

          // Reset session tracking
          localStorage.setItem('session_start_time', Date.now().toString());
          localStorage.setItem('last_activity_time', Date.now().toString());

          // Trigger permission refresh
          window.dispatchEvent(new Event('auth-change'));

          setStatus('success');
          // Dashboard page heading already shows a dynamic greeting right after
          // redirect - keep this toast short to avoid two stacked greetings.
          toast.success('Login berhasil!', { duration: 3000 });
          setTimeout(() => navigate('/'), 1000);
          return;
        } catch (err: any) {
          console.error('Google OAuth error:', err);
          setStatus('error');
          toast.error(err.response?.data?.error || 'Google login failed');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }
      }

      // Legacy flow - tokens in URL params
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const userId = searchParams.get('user_id');
      const username = searchParams.get('username');
      const email = searchParams.get('email');
      const fullName = searchParams.get('full_name');
      const isNew = searchParams.get('is_new') === 'true';

      if (!accessToken) {
        setStatus('error');
        toast.error('Invalid OAuth response');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // Store tokens
      localStorage.setItem('token', accessToken);
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }

      setStatus('success');

      // If new user, redirect to complete profile page
      if (isNew) {
        toast.success(`Akun berhasil dibuat! Silakan lengkapi profil Anda.`);
        const params = new URLSearchParams({
          access_token: accessToken,
          refresh_token: refreshToken || '',
          user_id: userId || '',
          username: username || '',
          email: email || '',
          full_name: fullName || ''
        });
        setTimeout(() => navigate(`/complete-profile?${params.toString()}`), 1000);
        return;
      }

      // Existing user - update Redux and go to dashboard
      dispatch(setCredentials({
        user: {
          id: parseInt(userId || '0'),
          username: username || '',
          email: email || '',
          full_name: fullName || '',
          is_admin: false,
          is_super_admin: false,
          roles: []
        },
        token: accessToken
      }));

      localStorage.setItem('session_start_time', Date.now().toString());
      localStorage.setItem('last_activity_time', Date.now().toString());

      toast.success(`Selamat datang kembali, ${fullName}!`);
      setTimeout(() => navigate('/'), 1000);
    };

    handleCallback();
  }, [searchParams, navigate, dispatch]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-[#064e3b] to-slate-900">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <div className="relative h-16 w-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-[3px] border-white/10" />
              <div
                className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#10b981] border-r-teal-400 animate-spin"
                style={{ animationDuration: '0.9s' }}
              />
              <div
                className="absolute inset-[6px] rounded-full border-[3px] border-transparent border-b-[#F15D2C] animate-spin [animation-direction:reverse]"
                style={{ animationDuration: '1.4s' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#059669] to-[#047857] animate-pulse" />
              </div>
            </div>
            <p className="text-white text-lg">Signing you in...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-400 text-6xl mb-4">✓</div>
            <p className="text-white text-lg">Login successful! Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-400 text-6xl mb-4">✗</div>
            <p className="text-white text-lg">Login failed. Redirecting to login page...</p>
          </>
        )}
      </div>
    </div>
  );
}
