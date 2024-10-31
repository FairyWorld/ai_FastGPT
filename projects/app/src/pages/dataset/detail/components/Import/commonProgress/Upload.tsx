import React, { useMemo } from 'react';
import { QuestionOutlineIcon } from '@chakra-ui/icons';
import {
  Box,
  TableContainer,
  Table,
  Thead,
  Tr,
  Th,
  Td,
  Tbody,
  Flex,
  Button,
  IconButton,
  Tooltip
} from '@chakra-ui/react';
import { ImportDataSourceEnum } from '@fastgpt/global/core/dataset/constants';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useRouter } from 'next/router';
import { TabEnum } from '../../../index';
import {
  postCreateDatasetCsvTableCollection,
  postCreateDatasetExternalFileCollection,
  postCreateDatasetFileCollection,
  postCreateDatasetLinkCollection,
  postCreateDatasetTextCollection
} from '@/web/core/dataset/api';
import MyTag from '@fastgpt/web/components/common/Tag/index';
import { useI18n } from '@/web/context/I18n';
import { useContextSelector } from 'use-context-selector';
import { DatasetPageContext } from '@/web/core/dataset/context/datasetPageContext';
import { DatasetImportContext, type ImportFormType } from '../Context';

const Upload = () => {
  const { t } = useTranslation();
  const { fileT } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const datasetDetail = useContextSelector(DatasetPageContext, (v) => v.datasetDetail);
  const { importSource, parentId, sources, setSources, processParamsForm, chunkSize } =
    useContextSelector(DatasetImportContext, (v) => v);

  const { handleSubmit } = processParamsForm;

  const { totalFilesCount, waitingFilesCount, allFinished, hasCreatingFiles } = useMemo(() => {
    const totalFilesCount = sources.length;

    const { waitingFilesCount, allFinished, hasCreatingFiles } = sources.reduce(
      (acc, file) => {
        if (file.createStatus === 'waiting') acc.waitingFilesCount++;
        if (file.createStatus === 'creating') acc.hasCreatingFiles = true;
        if (file.createStatus !== 'finish') acc.allFinished = false;
        return acc;
      },
      { waitingFilesCount: 0, allFinished: true, hasCreatingFiles: false }
    );

    return { totalFilesCount, waitingFilesCount, allFinished, hasCreatingFiles };
  }, [sources]);

  const buttonText = useMemo(() => {
    if (waitingFilesCount === totalFilesCount) {
      return t('common:core.dataset.import.Start upload');
    } else if (allFinished) {
      return t('common:core.dataset.import.Upload complete');
    } else {
      return t('common:core.dataset.import.Continue upload');
    }
  }, [waitingFilesCount, totalFilesCount, allFinished, t]);

  const { mutate: startUpload, isLoading } = useRequest({
    mutationFn: async ({ mode, customSplitChar, qaPrompt, webSelector }: ImportFormType) => {
      if (sources.length === 0) return;
      const filterWaitingSources = sources.filter((item) => item.createStatus === 'waiting');

      // Batch create collection and upload chunks
      for await (const item of filterWaitingSources) {
        setSources((state) =>
          state.map((source) =>
            source.id === item.id
              ? {
                  ...source,
                  createStatus: 'creating'
                }
              : source
          )
        );

        // create collection
        const commonParams = {
          parentId,
          trainingType: mode,
          datasetId: datasetDetail._id,
          chunkSize,
          chunkSplitter: customSplitChar,
          qaPrompt,

          name: item.sourceName
        };
        if (importSource === ImportDataSourceEnum.fileLocal && item.dbFileId) {
          await postCreateDatasetFileCollection({
            ...commonParams,
            fileId: item.dbFileId
          });
        } else if (importSource === ImportDataSourceEnum.fileLink && item.link) {
          await postCreateDatasetLinkCollection({
            ...commonParams,
            link: item.link,
            metadata: {
              webPageSelector: webSelector
            }
          });
        } else if (importSource === ImportDataSourceEnum.fileCustom && item.rawText) {
          // manual collection
          await postCreateDatasetTextCollection({
            ...commonParams,
            text: item.rawText
          });
        } else if (importSource === ImportDataSourceEnum.csvTable && item.dbFileId) {
          await postCreateDatasetCsvTableCollection({
            ...commonParams,
            fileId: item.dbFileId
          });
        } else if (importSource === ImportDataSourceEnum.externalFile && item.externalFileUrl) {
          await postCreateDatasetExternalFileCollection({
            ...commonParams,
            externalFileUrl: item.externalFileUrl,
            externalFileId: item.externalFileId,
            filename: item.sourceName
          });
        }

        setSources((state) =>
          state.map((source) =>
            source.id === item.id
              ? {
                  ...source,
                  createStatus: 'finish'
                }
              : source
          )
        );
      }
    },
    onSuccess() {
      if (!sources.some((file) => file.errorMsg !== undefined)) {
        toast({
          title: t('common:core.dataset.import.Import success'),
          status: 'success'
        });
      }

      // close import page
      router.replace({
        query: {
          ...router.query,
          currentTab: TabEnum.collectionCard
        }
      });
    },
    onError(error) {
      setSources((state) =>
        state.map((source) =>
          source.createStatus === 'creating'
            ? {
                ...source,
                createStatus: 'waiting',
                errorMsg: error.message || fileT('upload_failed')
              }
            : source
        )
      );
    },
    errorToast: fileT('upload_failed')
  });

  return (
    <Box>
      <TableContainer>
        <Table variant={'simple'} fontSize={'sm'} draggable={false}>
          <Thead draggable={false}>
            <Tr bg={'myGray.100'} mb={2}>
              <Th borderLeftRadius={'md'} overflow={'hidden'} borderBottom={'none'} py={4}>
                {t('common:core.dataset.import.Source name')}
              </Th>
              <Th borderBottom={'none'} py={4}>
                {t('common:core.dataset.import.Upload status')}
              </Th>
              <Th borderRightRadius={'md'} borderBottom={'none'} py={4}>
                {t('common:common.Action')}
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {sources.map((item) => (
              <Tr key={item.id}>
                <Td>
                  <Flex alignItems={'center'}>
                    <MyIcon name={item.icon as any} w={'16px'} mr={1} />
                    <Box whiteSpace={'wrap'} maxW={'30vw'}>
                      {item.sourceName}
                    </Box>
                  </Flex>
                </Td>
                <Td>
                  <Box display={'inline-block'}>
                    {item.errorMsg ? (
                      <Tooltip label={item.errorMsg} fontSize="md">
                        <Flex alignItems="center">
                          <MyTag colorSchema={'red'}>{t('common:common.Error')}</MyTag>
                          <QuestionOutlineIcon ml={2} color="red.500" w="14px" />
                        </Flex>
                      </Tooltip>
                    ) : (
                      <>
                        {item.createStatus === 'waiting' && (
                          <MyTag colorSchema={'gray'}>{t('common:common.Waiting')}</MyTag>
                        )}
                        {item.createStatus === 'creating' && (
                          <MyTag colorSchema={'blue'}>{t('common:common.Creating')}</MyTag>
                        )}
                        {item.createStatus === 'finish' && (
                          <MyTag colorSchema={'green'}>{t('common:common.Finish')}</MyTag>
                        )}
                      </>
                    )}
                  </Box>
                </Td>
                <Td>
                  {!hasCreatingFiles && item.createStatus !== 'finish' && (
                    <IconButton
                      variant={'grayDanger'}
                      size={'sm'}
                      icon={<MyIcon name={'delete'} w={'14px'} />}
                      aria-label={'Delete file'}
                      onClick={() => {
                        setSources((prevFiles) => prevFiles.filter((file) => file.id !== item.id));
                      }}
                    />
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      <Flex justifyContent={'flex-end'} mt={4}>
        <Button isLoading={isLoading} onClick={handleSubmit((data) => startUpload(data))}>
          {totalFilesCount > 0 &&
            `${t('common:core.dataset.import.Total files', {
              total: totalFilesCount
            })} | `}
          {buttonText}
        </Button>
      </Flex>
    </Box>
  );
};

export default Upload;
