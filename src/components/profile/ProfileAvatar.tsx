import { useState } from 'react';
import { profileInitials } from '../../utils/profilePresentation';

interface ProfileAvatarProps {
  name: string;
  src?: string | null;
  small?: boolean;
  onImageError?: () => void;
}

export function ProfileAvatar({ name, src, small, onImageError }: ProfileAvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <span className={`profile-avatar${small ? ' profile-avatar--small' : ''}`} aria-hidden="true">
      {src && src !== failedSource ? (
        <img src={src} alt="" onError={() => { setFailedSource(src); onImageError?.(); }} />
      ) : profileInitials(name)}
    </span>
  );
}
