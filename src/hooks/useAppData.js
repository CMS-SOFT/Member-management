import { useState, useEffect, useCallback } from 'react';
import { mergeSheetMembers, normalizeSchedules } from '../lib/sheet';
import { requestBootstrap } from '../lib/bootstrapService';

export function useAppData() {
    const [directoryMembers, setDirectoryMembers] = useState([]);
    const [adminMembers, setAdminMembers] = useState([]);
    const [adminSchedules, setAdminSchedules] = useState([]);
    const [adminPasses, setAdminPasses] = useState([]);
    const [adminSettlements, setAdminSettlements] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const refreshAppData = useCallback(async () => {
        try {
            const result = await requestBootstrap();
            setDirectoryMembers(result.members || []);
            setAdminMembers(mergeSheetMembers(result.members || [], result.histories || []));
            setAdminSchedules(normalizeSchedules(result.schedules || []));
            setAdminPasses(result.passes || []);
            setAdminSettlements(result.settlements || []);
            setLoadError('');
        } catch (error) {
            console.error('데이터를 갱신하지 못했습니다:', error);
            throw error;
        }
    }, []);

    useEffect(() => {
        let active = true;

        requestBootstrap()
            .then((result) => {
                if (!active) return;
                setDirectoryMembers(result.members || []);
                setAdminMembers(mergeSheetMembers(result.members || [], result.histories || []));
                setAdminSchedules(normalizeSchedules(result.schedules || []));
                setAdminPasses(result.passes || []);
                setAdminSettlements(result.settlements || []);
                setLoadError('');
            })
            .catch((error) => {
                if (active) {
                    setLoadError(error.message || '저장된 자료를 불러오지 못했어요.');
                }
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    return {
        directoryMembers,
        adminMembers,
        adminSchedules,
        setAdminSchedules,
        adminPasses,
        setAdminPasses,
        adminSettlements,
        setAdminSettlements,
        isLoading,
        setIsLoading,
        loadError,
        setLoadError,
        refreshAppData,
    };
}