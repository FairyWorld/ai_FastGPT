import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { connectToDatabase } from '@/service/mongo';
import { MongoBill } from '@fastgpt/service/support/wallet/bill/schema';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { BillSourceEnum } from '@fastgpt/global/support/wallet/bill/constants';
import { CreateTrainingBillProps } from '@fastgpt/global/support/wallet/bill/api.d';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectToDatabase();
    const { name } = req.body as CreateTrainingBillProps;

    const { teamId, tmbId } = await authCert({ req, authToken: true, authApiKey: true });

    const qaModel = global.qaModels[0];

    const { _id } = await MongoBill.create({
      teamId,
      tmbId,
      appName: name,
      source: BillSourceEnum.training,
      list: [
        {
          moduleName: '索引生成',
          model: 'embedding',
          amount: 0,
          tokenLen: 0
        },
        {
          moduleName: 'QA 拆分',
          model: qaModel?.name,
          amount: 0,
          tokenLen: 0
        }
      ],
      total: 0
    });

    jsonRes<string>(res, {
      data: _id
    });
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
