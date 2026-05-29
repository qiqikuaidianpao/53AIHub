import service from '../../config'
import { handleError } from '../../errorHandler'
import type {
  SkillExploreItem,
  SkillExploreQuery,
  SkillDetail,
  SkillMyItem,
  PagedResponse,
  ApiResponse,
  UpdateMySkillStatusRequest,
} from './types'
import type { Skill } from './types'

export type { Skill }

export const skillApi = {
  /**
   * 获取探索列表
   * GET /api/skill-library/explore
   */
  explore(params?: SkillExploreQuery): Promise<{ items: SkillExploreItem[]; count: number }> {
    return service
      .get('/api/skill-library/explore', { params })
      .then((res: { data: PagedResponse<SkillExploreItem> }) => ({
        items: res.data?.items || [],
        count: res.data?.count || 0,
      }))
      .catch(handleError)
  },

  /**
   * 获取技能详情
   * GET /api/skill-library/:id
   */
  getDetail(id: string): Promise<SkillExploreItem> {
    return service
      .get(`/api/skill-library/${id}`)
      .then((res: { data: SkillDetail }) => res.data)
      .catch(handleError)
  },

  /**
   * 添加技能到"我的"
   * POST /api/skill-library/:id/add
   */
  addToMy(id: string): Promise<ApiResponse<null>> {
    return service.post(`/api/skill-library/${id}/add`)
  },

  /**
   * 获取我的技能列表
   * GET /api/skill-library/my
   */
  getMyList(params?: { offset?: number; limit?: number }) {
    return service
      .get('/api/skill-library/my', { params, requiresAuth: true })
      .then((res: { data: PagedResponse<SkillMyItem> }) => ({
        items: res.data?.items || [],
        count: res.data?.count || 0,
      }))
      .catch(handleError)
  },

  /**
   * 更新我的技能状态（启停）
   * PATCH /api/skill-library/my/{binding_id}/status
   */
  updateMySkillStatus(bindingId: string, data: UpdateMySkillStatusRequest) {
    return service.patch(`/api/skill-library/my/${bindingId}/status`, data).catch(handleError)
  },

  /**
   * 删除我的技能
   * DELETE /api/skill-library/my/{binding_id}
   */
  deleteMySkill(bindingId: string) {
    return service.delete(`/api/skill-library/my/${bindingId}`).catch(handleError)
  },

  /**
   * 下载技能安装包
   * GET /api/skill-library/{id}/download
   */
  downloadSkillPackage(id: string) {
    return service.get(`/api/skill-library/${id}/download`, {
      responseType: 'blob',
    }).catch(handleError)
  },

  /**
   * 获取技能 SKILL.md
   * GET /api/skill-library/{id}/skill-md
   */
  getSkillMd(id: string) {
    return service.get(`/api/skill-library/${id}/skill-md`, {
      responseType: 'text',
    }).catch(handleError)
  },
}

export default skillApi
