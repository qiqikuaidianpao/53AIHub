import ProcessFlow from './ProcessFlow';
import type { ProcessFlowHeaderProps } from './types';

/**
 * ProcessFlowHeader 组件
 * 统一渲染流程步骤，按时序展示
 */
const ProcessFlowHeader: React.FC<ProcessFlowHeaderProps> = (props) => {
  return <ProcessFlow {...props} />;
};

export default ProcessFlowHeader;
