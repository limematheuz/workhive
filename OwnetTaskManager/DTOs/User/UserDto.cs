namespace OwnetTaskManager.DTOs.User;

public class UserDto
{
    public string Username { get; set; }
    public int CompanyId { get; set; } // Relación con la empresa
    public string CompanyName { get; set; } // Nombre de la empresa
    public int RoleId { get; set; } // Relación con el rol
    public string RoleName { get; set; } // Nombre del rol
}