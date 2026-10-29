import { useCallback, useEffect, useRef, useState } from 'react';
import { getPersonalProfile, ProfileApiError, updateAdminProfile, updateHostProfile } from '../services/profileApi';
import { validateAdminProfile, validateHostProfile, validateLogo } from '../schemas/profileValidation';
import { profileMessages, type PersonalProfileResponse, type ProfileEditableField, type ProfileFormData, type ProfileFormErrors, type ProfileStatus } from '../types/profile';

function toForm(profile: PersonalProfileResponse | null): ProfileFormData | null {
  if (profile?.role === 'ADMIN') return { role: 'ADMIN', fullName: profile.fullName, phoneNumber: profile.phoneNumber ?? '' };
  if (profile?.role === 'HOST') return { role: 'HOST', businessName: profile.businessName, phoneNumber: profile.phoneNumber, officeAddress: profile.officeAddress ?? '' };
  return null;
}

export function useProfile(onSessionExpired: () => void) {
  const [profile, setProfile] = useState<PersonalProfileResponse | null>(null);
  const [formData, setFormData] = useState<ProfileFormData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ProfileFormErrors>({});
  const [status, setStatus] = useState<ProfileStatus>('idle');
  const [generalErrorMessage, setGeneralErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const alive = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const saving = useRef(false);
  const preview = useRef<string | null>(null);
  const selectionError = useRef<string | undefined>(undefined);

  const clearLogo = useCallback(() => {
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = null;
    selectionError.current = undefined;
    setLogoPreviewUrl(null);
    setLogoFile(null);
    setRemoveLogo(false);
  }, []);

  const fetchProfile = useCallback(async () => {
    if (saving.current) return;
    const request = ++generation.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setStatus('loading');
    setLoadFailed(false);
    setGeneralErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await getPersonalProfile(controller.current.signal);
      if (!alive.current || request !== generation.current) return;
      setProfile(result);
      setFormData(toForm(result));
      setStatus('idle');
    } catch (error) {
      if (!alive.current || request !== generation.current || (error instanceof Error && error.name === 'AbortError')) return;
      if (error instanceof ProfileApiError && error.status === 401) { onSessionExpired(); return; }
      setLoadFailed(true);
      setStatus('error');
      setGeneralErrorMessage(error instanceof ProfileApiError ? error.message : profileMessages.loadFailure);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    alive.current = true;
    const requestGeneration = generation;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void fetchProfile(); });
    return () => {
      cancelled = true;
      alive.current = false;
      requestGeneration.current++;
      controller.current?.abort();
      if (preview.current) URL.revokeObjectURL(preview.current);
      preview.current = null;
    };
  }, [fetchProfile]);

  const cancelEditing = useCallback(() => {
    if (saving.current) return;
    clearLogo();
    setFormData(toForm(profile));
    setIsEditing(false);
    setFieldErrors({});
    setGeneralErrorMessage(null);
    setSuccessMessage(null);
    setStatus('idle');
  }, [clearLogo, profile]);

  const startEditing = () => {
    if (!profile || profile.role === 'CUSTOMER' || status === 'loading' || saving.current || loadFailed) return;
    cancelEditing();
    setIsEditing(true);
  };

  const handleFieldChange = (field: ProfileEditableField, value: string) => {
    if (saving.current) return;
    setFormData((current) => current && Object.hasOwn(current, field) ? { ...current, [field]: value } : current);
    setFieldErrors((current) => { const next = { ...current }; delete next[field]; return next; });
    setGeneralErrorMessage(null);
  };

  const handleLogoSelect = (file: File) => {
    if (saving.current || formData?.role !== 'HOST') return;
    const error = validateLogo(file);
    selectionError.current = error;
    setFieldErrors((current) => ({ ...current, logo: error }));
    if (error) return;
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = URL.createObjectURL(file);
    setLogoPreviewUrl(preview.current);
    setLogoFile(file);
    setRemoveLogo(false);
    setGeneralErrorMessage(null);
  };

  const handleRemoveLogoToggle = () => {
    if (saving.current || formData?.role !== 'HOST') return;
    const next = !removeLogo;
    clearLogo();
    setRemoveLogo(next);
    setFieldErrors((current) => ({ ...current, logo: undefined }));
    setGeneralErrorMessage(null);
  };

  const handleLogoPreviewError = () => {
    if (!logoFile) return;
    selectionError.current = profileMessages.imageFailure;
    setFieldErrors((current) => ({ ...current, logo: profileMessages.imageFailure }));
  };

  const handleSubmit = async () => {
    if (saving.current || !isEditing || !formData || !profile || profile.role === 'CUSTOMER') return;
    const admin = formData.role === 'ADMIN' ? { fullName: formData.fullName.trim(), phoneNumber: formData.phoneNumber || null } : null;
    const host = formData.role === 'HOST' ? {
      businessName: formData.businessName.trim(), phoneNumber: formData.phoneNumber,
      officeAddress: formData.officeAddress.trim() || null, removeLogo,
    } : null;
    const errors = admin ? validateAdminProfile(admin) : host ? validateHostProfile(host, logoFile) : {};
    if (selectionError.current) errors.logo = selectionError.current;
    setFieldErrors(errors);
    setGeneralErrorMessage(null);
    setSuccessMessage(null);
    if (Object.keys(errors).length) { setStatus('error'); return; }
    saving.current = true;
    const request = ++generation.current;
    controller.current?.abort();
    setStatus('saving');
    try {
      const result = admin ? await updateAdminProfile(admin) : await updateHostProfile(host!, logoFile);
      if (!alive.current || request !== generation.current) return;
      setProfile(result);
      setFormData(toForm(result));
      clearLogo();
      setIsEditing(false);
      setStatus('success');
      setSuccessMessage(profileMessages.success);
    } catch (error) {
      if (!alive.current || request !== generation.current) return;
      if (error instanceof ProfileApiError && error.status === 401) { onSessionExpired(); return; }
      const apiError = error instanceof ProfileApiError ? error : new ProfileApiError(0, profileMessages.saveFailure);
      const inline: ProfileFormErrors = {};
      const banner: string[] = [];
      for (const [field, message] of Object.entries(apiError.fieldErrors)) {
        if (field === 'logo' && formData.role === 'HOST') inline.logo = message;
        else if (Object.hasOwn(formData, field) && field !== 'role') inline[field as ProfileEditableField] = message;
        else banner.push(message);
      }
      if (apiError.status === 409 && formData.role === 'HOST' && !inline.phoneNumber) inline.phoneNumber = profileMessages.phoneDuplicate;
      setFieldErrors(inline);
      setGeneralErrorMessage(banner.length ? [...new Set(banner)].join(' ') : Object.keys(inline).length && apiError.status !== 0 && apiError.status < 500 ? null : apiError.message);
      setStatus('error');
    } finally {
      saving.current = false;
    }
  };

  const isDirty = isEditing && (JSON.stringify(formData) !== JSON.stringify(toForm(profile)) || !!logoFile || removeLogo);
  return { profile, formData, isEditing, isDirty, logoFile, logoPreviewUrl, removeLogo, fieldErrors, status,
    generalErrorMessage, successMessage, loadFailed, fetchProfile, startEditing, cancelEditing,
    handleFieldChange, handleLogoSelect, handleLogoPreviewError, handleRemoveLogoToggle, handleSubmit };
}

export type ProfileController = ReturnType<typeof useProfile>;
