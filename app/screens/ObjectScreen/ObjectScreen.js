import React, { useEffect, useState } from 'react';
import { FlatList, SafeAreaView, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, queryCache } from 'react-query';
import { CommonActions, useRoute, useNavigation } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-simple-toast';
import * as contentTypesAction from '../../store/actions/contentTypes';

import ApiTokenError from '../../api/http/errors/apiTokenError';
import ApiNoDataError from '../../api/http/errors/apiNoDataError';
import * as authTypesActions from '../../store/actions/auth';
import * as httpCT from '../../api/http/rquests/contentTypes';
import { fetchingDataErrorAlert,
    confirmDeleteAction,
    postDataError } from '../../helpers/alertsHelper';
import { getDefinitionData } from '../../helpers/definitionObjectsHelper';

import MenuDropdown from '../../components/MenuDropdown/MenuDropdown';
import ListItemWIthHtmlContent from '../../components/ListItemWithHtmlContent/ListItemWithHtmlContent';
import IndicatorOverlay from '../../components/Indicators/IndicatorOverlay';
import ListHeaderIndicator from '../../components/Indicators/List/Header/ListHeaderIndicator';
import FormModal from '../../components/FormModal/FormModal';

import styles from './styles';
import Colors from '../../helpers/constants/colors';

const ObjectScreen = (props) => {
    const { objectId, ctoName, withReachTextProps, partOfTitleProps } = props.route.params;
    const contentObject = useSelector((state) => state.contentTypes.object);
    const contentTypesDefinitions = useSelector((state) => state.contentTypes.definitions);
    const dispatch = useDispatch();

    const route = useRoute();
    const navigation = useNavigation();

    const [isUpdate, setIsUpdate] = useState();

    const [netInfo, setNetInfo] = useState({
        isConnected: true,
        isInternetReachable: true,
    });

    useEffect(() => {
        if (route.params.deleteContentTypeObject) {
            const onDeleteHandler = async (ctoId) => {
                if (!ctoId) return;
                try {
                    navigation.dispatch(CommonActions.setParams({ deleteContentTypeObject: false }));
                    confirmDeleteAction('Are you sure?').then(async (r) => {
                        if (r === 'CANCEL') return;
                        setIsUpdate(true);
                        await httpCT.removeContentObject(ctoName, ctoId);
                        navigation.navigate({
                            name: 'ContentTypeObjectsScreen',
                            params: {
                                refetchData: true,
                            },
                        });
                    });
                } catch (error) {
                    Alert.alert(
                        'Error!',
                        error.message,
                    );
                    setIsUpdate(false);
                }
            };
            onDeleteHandler(objectId);
        }
    });

    useEffect(() => {
        NetInfo.fetch().then((state) => {
            const connected = state.isConnected && state.isInternetReachable;
            if (!connected) {
                setNetInfo({
                    isConnected: state.isConnected,
                    isInternetReachable: state.isInternetReachable,
                });
            }
        });
    }, []);

    const {
        status,
        data,
        refetch,
        isFetching,
    } = useQuery((ctoName && objectId) && [ctoName, objectId], httpCT.fetchContentObject, {
        retry: 1,
        onError: (err) => {
            const noPersistedData = !contentObject || !contentObject[ctoName] || !contentObject[ctoName][objectId];
            if (netInfo.isInternetReachable) {
                if (err instanceof ApiTokenError) {
                    dispatch(authTypesActions.validateApiToken(false));
                    return;
                }
                if (err instanceof ApiNoDataError) {
                    dispatch(contentTypesAction.clearContentObject(ctoName, objectId));
                    fetchingDataErrorAlert(err.message).then(() => {
                        queryCache.removeQueries(ctoName);
                        props.navigation.navigate({
                            name: 'ContentTypeObjectsScreen',
                            params: {
                                refetchData: true,
                            },
                        });
                    });
                    return;
                }
            }
            if (noPersistedData) {
                fetchingDataErrorAlert(err.message).then(() => {
                    queryCache.removeQueries(ctoName);
                    props.navigation.navigate('ContentTypeObjectsScreen');
                });
            } else {
                Toast.showWithGravity(err.message, Toast.LONG, Toast.CENTER);
            }
        },
        onSuccess: (dat) => {
            dispatch(contentTypesAction.setContentObject(ctoName, data));
            return dat;
        },
    });

    if (((isFetching || status === 'loading')
        && (!contentObject || !contentObject[ctoName] || !contentObject[ctoName][objectId])) || isUpdate) {
        return <IndicatorOverlay />;
    }

    const renderItem = (item) => Object.keys(item.item).map((el, i) => (el !== 'object_data'
        ? (
            <ListItemWIthHtmlContent
                key={`${item.item.id}-child-${i}`}
                item={item.item[el]}
                element={el}
                withHtml={withReachTextProps}
            />
        )
        : null));
    const listLoader = () => {
        if (status !== 'loading' && isFetching) return <ListHeaderIndicator />;

        return null;
    };

    const returnListData = () => {
        const dataIsNotEmpty = data && data.length > 0;
        const persistedData = contentObject && contentObject[ctoName] && contentObject[ctoName][objectId];
        if (persistedData && (!netInfo.isInternetReachable || !dataIsNotEmpty)) return [contentObject[ctoName][objectId]];
        if (data) return [data];
        return [];
    };

    const onPressSaveHandler = async (formData) => {
        const response = formData;
        try {
            setIsUpdate(true);
            await httpCT.updateContentObject(ctoName, objectId, response);
            props.navigation.navigate({
                name: 'ContentTypeObjectsScreen',
                params: {
                    refetchData: true,
                },
            });
        } catch (error) {
            postDataError(error.message).then(async (r) => {
                if (r === 'OK') {
                    setIsUpdate(false);
                }
            });
        }
    };

    return (
        <SafeAreaView>
            <FlatList
                keyExtractor={(item) => item.id}
                data={returnListData()}
                renderItem={renderItem}
                ListHeaderComponent={listLoader}
                refreshing={status === 'loading' && !isFetching}
                onRefresh={() => refetch()}
            />
            {(route.params.formModalVisibility && contentTypesDefinitions && ctoName)
                && (
                    <FormModal
                        edit={objectId}
                        isModalVisible={route.params.formModalVisibility}
                        onPressSave={onPressSaveHandler}
                        onPressCancel={() => {
                            props.navigation.dispatch(CommonActions.setParams({ formModalVisibility: false }));
                        }}
                        dataName={ctoName}
                        data={getDefinitionData(contentTypesDefinitions)}
                        partOfTitleProps={partOfTitleProps}
                    />
                )}
        </SafeAreaView>
    );
};

export const contentObjectScreenOptions = ({ route, navigation }) => {
    const ctoName = route.params.objectName || 'Details';
    const screenTitle = route.params.objectLabel
        ? `${ctoName} - ${route.params.objectLabel}` : 'Object Details';
    const items = [
        {
            title: 'Edit',
            titleStyle: { color: Colors.primary },
            onPressAction: () => {
                navigation.dispatch(CommonActions.setParams({ formModalVisibility: true }));
            },
        },
        {
            title: 'Delete',
            titleStyle: { color: Colors.danger },
            onPressAction: () => {
                navigation.dispatch(CommonActions.setParams({ deleteContentTypeObject: true }));
            },
        },
    ];
    return (
        {
            headerTitle: screenTitle,
            headerTitleStyle: styles.headerOptionsTitle,
            headerRight: () => (
                <MenuDropdown
                    items={items}
                />
            ),
        }
    );
};

export default ObjectScreen;
