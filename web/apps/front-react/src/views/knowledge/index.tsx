import { useParams } from "react-router-dom";
import {
  useEnterpriseStore,
  useIsSoftStyle,
} from "@/stores/modules/enterprise";
import { t } from "@/locales";
import GroupList from "./components/GroupList";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";
import "./knowledge.css";

export function KnowledgeView() {
  const { space_id } = useParams<{ space_id: string }>();
  const isSoftStyle = useIsSoftStyle();

  return (
    <div className="knowledge-view">
      {isSoftStyle && <Header title={t("module.knowledge")} />}
      <div className="w-11/12 lg:w-4/5 mx-auto py-4 md:py-6 lg:py-8">
        <GroupList stickyOffset={isSoftStyle ? 64 : 0} spaceId={space_id} />
      </div>
      <Footer />
    </div>
  );
}

export default KnowledgeView;
