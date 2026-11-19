import {CompanyOperationsSettings} from "@/components/organization/CompanyOperationsSettings";
import { OrganizationControlCenter } from "@/components/organization/OrganizationControlCenter";
import {CompanyViewSession} from "@/components/company/CompanyViewSession";

export default function OrganizationPage() {
    return <CompanyViewSession><OrganizationControlCenter /><CompanyOperationsSettings/></CompanyViewSession>;
}
